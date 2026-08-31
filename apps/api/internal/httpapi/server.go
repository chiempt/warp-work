// Package httpapi builds the Echo server.
//
// Handlers here are thin: they parse, delegate to a service, and render. The
// generated OpenAPI interfaces (docs/api/openapi.yaml) will replace the manual
// route registration below once the first real endpoint exists.
package httpapi

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"

	"github.com/labstack/echo/v4"

	"github.com/chiempham/warp-work/apps/api/internal/api"
	"github.com/chiempham/warp-work/internal/auth"
	"github.com/chiempham/warp-work/internal/config"
	"github.com/chiempham/warp-work/internal/platform/postgres"
)

// Server owns the HTTP listener and its dependencies.
type Server struct {
	echo   *echo.Echo
	cfg    config.Config
	logger *slog.Logger
	pool   *postgres.Pool
	auth   *auth.Service
}

// New wires the server. It does not listen; call Start for that.
//
// New returns an error only if the generated API server cannot be constructed,
// which means the spec and the generated code disagree — a build-time problem
// surfacing at startup, not a runtime condition.
func New(cfg config.Config, logger *slog.Logger, pool *postgres.Pool) (*Server, error) {
	e := echo.New()
	e.HideBanner = true
	e.HidePort = true
	e.HTTPErrorHandler = errorHandler(logger)

	// The pool may be nil in tests that never reach the database.
	var authSvc *auth.Service
	if pool != nil {
		authSvc = auth.NewService(auth.NewPgxStore(pool), nil)
	}

	s := &Server{echo: e, cfg: cfg, logger: logger, pool: pool, auth: authSvc}

	e.Use(defaultMiddleware(logger)...)
	if err := s.routes(); err != nil {
		return nil, err
	}
	return s, nil
}

func (s *Server) routes() error {
	// Operational endpoints sit outside the versioned API: they are for the
	// container runtime, not for clients.
	s.echo.GET("/healthz", s.live)
	s.echo.GET("/readyz", s.ready)

	s.registerDocs()

	// Everything under /api/v1 is routed, decoded, and validated by the code
	// ogen generates from docs/api/openapi.yaml. Echo owns the outer server —
	// request ids, structured logging, recovery, and the operational endpoints
	// — and hands the versioned API over wholesale. Routes are not declared
	// here; they are declared in the spec.
	apiServer, err := api.NewServer(
		NewHandler(s.cfg, s.logger, s.pool, s.auth),
		&securityHandler{auth: s.auth, logger: s.logger},
		api.WithErrorHandler(ogenErrorHandler(s.logger)),
		api.WithNotFound(notFoundHandler),
		api.WithMethodNotAllowed(methodNotAllowedHandler),
	)
	if err != nil {
		return fmt.Errorf("build API server from the OpenAPI contract: %w", err)
	}

	s.echo.Any("/api/v1/*", echo.WrapHandler(apiServer))
	return nil
}

// errListenerStopped means Serve returned although nothing asked it to. There
// is no error to report and the process must not treat it as a clean exit:
// exiting zero here is indistinguishable, from the outside, from a service that
// was never asked to run.
var errListenerStopped = errors.New("http listener stopped without being asked to")

// Start listens until ctx is cancelled, then drains in-flight requests.
func (s *Server) Start(ctx context.Context) error {
	addr := fmt.Sprintf(":%d", s.cfg.API.Port)

	// Buffered and never closed. An earlier version closed it, and a receive
	// from a closed channel yields a nil error — so any path where Serve
	// returned first made Start report success, main return nil, and the
	// process exit 0 with nothing in the log to say why.
	errs := make(chan error, 1)
	go func() {
		s.logger.Info("api listening", slog.String("addr", addr), slog.String("env", string(s.cfg.Env)))
		err := s.echo.Start(addr)
		if errors.Is(err, http.ErrServerClosed) {
			// Expected only after Shutdown, which the ctx branch below owns.
			err = nil
		}
		errs <- err
	}()

	select {
	case err := <-errs:
		if err != nil {
			return err
		}
		return errListenerStopped
	case <-ctx.Done():
	}

	shutdownCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), s.cfg.API.ShutdownTimeout)
	defer cancel()

	s.logger.Info("api draining", slog.Duration("timeout", s.cfg.API.ShutdownTimeout))
	if err := s.echo.Shutdown(shutdownCtx); err != nil {
		return fmt.Errorf("shutdown: %w", err)
	}
	s.logger.Info("api stopped")
	return nil
}

// Handler exposes the router for tests.
func (s *Server) Handler() http.Handler { return s.echo }
