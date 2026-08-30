package httpapi_test

import (
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/chiempham/warp-work/apps/api/internal/httpapi"
	"github.com/chiempham/warp-work/internal/config"
)

func newServer(t *testing.T) http.Handler {
	t.Helper()
	logger := slog.New(slog.DiscardHandler)
	// The pool is only touched by /readyz, which these tests do not exercise.
	srv, err := httpapi.New(config.Config{Env: config.EnvDevelopment}, logger, nil)
	if err != nil {
		t.Fatalf("build server: %v", err)
	}
	return srv.Handler()
}

func TestLiveness_doesNotDependOnTheDatabase(t *testing.T) {
	rec := httptest.NewRecorder()
	newServer(t).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/healthz", nil))

	if rec.Code != http.StatusOK {
		t.Fatalf("want 200, got %d", rec.Code)
	}
}

func TestRequestIDIsReturned(t *testing.T) {
	rec := httptest.NewRecorder()
	newServer(t).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/healthz", nil))

	if rec.Header().Get("X-Request-Id") == "" {
		t.Fatal("every response must carry a request id so a log line can be found from a client report")
	}
}
