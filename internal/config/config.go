// Package config parses the process environment exactly once into a typed
// struct. Nothing else in the codebase reads os.Getenv.
package config

import (
	"encoding/base64"
	"errors"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

// Env is the deployment environment. It gates nothing security-related on its
// own — a secret that is required in production is required in development too.
type Env string

const (
	EnvDevelopment Env = "development"
	EnvProduction  Env = "production"
)

// Config is the whole of the process configuration. Pass it to constructors;
// do not reach for it from a package-level variable.
type Config struct {
	Env         Env
	API         API
	Log         Log
	Postgres    Postgres
	Redis       Redis
	Claude      Claude
	Google      Google
	Web         Web
	Credentials Credentials
}

type API struct {
	Port            int
	ShutdownTimeout time.Duration
}

type Log struct {
	Level string
	// Format is "json" or "console". JSON is the shape everything downstream
	// reads; console is for a human watching a terminal, and is the default
	// only in development.
	Format string
}

// Log formats.
const (
	LogJSON    = "json"
	LogConsole = "console"
)

type Postgres struct {
	URL          string
	MaxConns     int32
	MaxConnIdle  time.Duration
	QueryTimeout time.Duration
}

type Redis struct {
	URL         string
	Concurrency int
}

// Claude holds the model tiers fixed by ADR 0003. Phase 1 makes no model calls,
// so the API key is optional; Enabled reports whether model work is possible.
type Claude struct {
	APIKey          string
	RoutingModel    string
	ExtractionModel string
	DraftingModel   string
}

func (c Claude) Enabled() bool { return c.APIKey != "" }

// Web is where the browser reaches the application. apps/web proxies /api/v1
// through to this service, so a sign-in has to come back through that origin —
// otherwise the redirect after it lands on the API, which serves no pages.
type Web struct {
	BaseURL string
}

// Google covers the Phase 1 connectors: Gmail, Calendar, Drive. Optional until
// the OAuth flow exists.
type Google struct {
	ClientID     string
	ClientSecret string
	RedirectURL  string
}

func (g Google) Configured() bool { return g.ClientID != "" && g.ClientSecret != "" }

// Credentials holds the key that encrypts accounts.credentials_enc at rest.
type Credentials struct {
	EncryptionKey []byte
}

// Load reads the environment and reports *every* problem at once. A process
// that starts with half its configuration is worse than one that refuses to
// start with a complete list of what is missing.
// defaultLogFormat picks the format nobody has asked for explicitly. It reads
// APP_ENV directly rather than the parsed value because the two are decided in
// the same struct literal, and Go does not order those fields.
func defaultLogFormat(appEnv string) string {
	if appEnv == "" || appEnv == string(EnvDevelopment) {
		return LogConsole
	}
	return LogJSON
}

func Load() (Config, error) {
	l := &loader{}

	cfg := Config{
		Env: Env(l.oneOf("APP_ENV", string(EnvDevelopment), string(EnvDevelopment), string(EnvProduction))),
		API: API{
			Port:            l.intVal("API_PORT", 8080),
			ShutdownTimeout: l.duration("API_SHUTDOWN_TIMEOUT", 20*time.Second),
		},
		Log: Log{
			Level: l.oneOf("LOG_LEVEL", "info", "debug", "info", "warn", "error"),
			// Defaults to whatever suits the reader: a person in development, a
			// log collector everywhere else. `LOG_FORMAT` overrides either way,
			// so a developer can reproduce production's exact output.
			Format: l.oneOf("LOG_FORMAT", defaultLogFormat(l.optional("APP_ENV")), LogJSON, LogConsole),
		},
		Postgres: Postgres{
			URL:          l.required("DATABASE_URL"),
			MaxConns:     int32(l.intVal("DATABASE_MAX_CONNS", 10)),
			MaxConnIdle:  l.duration("DATABASE_MAX_CONN_IDLE", 5*time.Minute),
			QueryTimeout: l.duration("DATABASE_QUERY_TIMEOUT", 10*time.Second),
		},
		Redis: Redis{
			URL:         l.required("REDIS_URL"),
			Concurrency: l.intVal("WORKER_CONCURRENCY", 8),
		},
		Claude: Claude{
			APIKey:          l.optional("ANTHROPIC_API_KEY"),
			RoutingModel:    l.str("MODEL_ROUTING", "claude-haiku-4-5"),
			ExtractionModel: l.str("MODEL_EXTRACTION", "claude-sonnet-5"),
			DraftingModel:   l.str("MODEL_DRAFTING", "claude-opus-5"),
		},
		Google: Google{
			ClientID:     l.optional("GOOGLE_CLIENT_ID"),
			ClientSecret: l.optional("GOOGLE_CLIENT_SECRET"),
			RedirectURL:  l.str("GOOGLE_REDIRECT_URL", "http://localhost:8080/api/v1/oauth/google/callback"),
		},
		Web: Web{
			BaseURL: l.str("WEB_BASE_URL", "http://localhost:3000"),
		},
		Credentials: Credentials{
			EncryptionKey: l.key("CREDENTIALS_ENCRYPTION_KEY", 32),
		},
	}

	if len(l.errs) > 0 {
		return Config{}, fmt.Errorf("configuration: %w", errors.Join(l.errs...))
	}
	return cfg, nil
}

type loader struct {
	errs []error
}

func (l *loader) fail(format string, args ...any) {
	l.errs = append(l.errs, fmt.Errorf(format, args...))
}

func (l *loader) optional(key string) string {
	return strings.TrimSpace(os.Getenv(key))
}

func (l *loader) str(key, def string) string {
	if v := l.optional(key); v != "" {
		return v
	}
	return def
}

func (l *loader) required(key string) string {
	v := l.optional(key)
	if v == "" {
		l.fail("%s is required", key)
	}
	return v
}

func (l *loader) intVal(key string, def int) int {
	raw := l.optional(key)
	if raw == "" {
		return def
	}
	n, err := strconv.Atoi(raw)
	if err != nil {
		l.fail("%s must be an integer, got %q", key, raw)
		return def
	}
	return n
}

func (l *loader) duration(key string, def time.Duration) time.Duration {
	raw := l.optional(key)
	if raw == "" {
		return def
	}
	d, err := time.ParseDuration(raw)
	if err != nil {
		l.fail("%s must be a duration such as 30s or 5m, got %q", key, raw)
		return def
	}
	return d
}

func (l *loader) oneOf(key, def string, allowed ...string) string {
	v := l.str(key, def)
	for _, a := range allowed {
		if v == a {
			return v
		}
	}
	l.fail("%s must be one of %s, got %q", key, strings.Join(allowed, ", "), v)
	return def
}

// key decodes a base64 secret and checks its length. A short key is a silent
// weakening of encryption at rest, so it is a startup failure.
func (l *loader) key(name string, wantBytes int) []byte {
	raw := l.required(name)
	if raw == "" {
		return nil
	}
	b, err := base64.StdEncoding.DecodeString(raw)
	if err != nil {
		l.fail("%s must be base64", name)
		return nil
	}
	if len(b) != wantBytes {
		l.fail("%s must decode to %d bytes, got %d", name, wantBytes, len(b))
		return nil
	}
	return b
}
