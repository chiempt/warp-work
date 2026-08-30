package httpapi_test

import (
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/chiempham/warp/apps/api/internal/httpapi"
	"github.com/chiempham/warp/internal/config"
)

func newServer(t *testing.T) http.Handler {
	t.Helper()
	logger := slog.New(slog.DiscardHandler)
	// The pool is only touched by /readyz, which these tests do not exercise.
	return httpapi.New(config.Config{Env: config.EnvDevelopment}, logger, nil).Handler()
}

func TestLiveness_doesNotDependOnTheDatabase(t *testing.T) {
	rec := httptest.NewRecorder()
	newServer(t).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/healthz", nil))

	if rec.Code != http.StatusOK {
		t.Fatalf("want 200, got %d", rec.Code)
	}
}

// Every error the API returns has to arrive in one shape, so the frontend has
// exactly one branch to write.
func TestUnknownRoute_returnsTheErrorEnvelope(t *testing.T) {
	rec := httptest.NewRecorder()
	newServer(t).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/v1/nope", nil))

	if rec.Code != http.StatusNotFound {
		t.Fatalf("want 404, got %d", rec.Code)
	}

	body, err := io.ReadAll(rec.Body)
	if err != nil {
		t.Fatal(err)
	}

	var envelope struct {
		Error struct {
			Code    string `json:"code"`
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := json.Unmarshal(body, &envelope); err != nil {
		t.Fatalf("response is not the error envelope: %v (%s)", err, body)
	}
	if envelope.Error.Code != "not_found" {
		t.Errorf("want code not_found, got %q", envelope.Error.Code)
	}
}

func TestRequestIDIsReturned(t *testing.T) {
	rec := httptest.NewRecorder()
	newServer(t).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/healthz", nil))

	if rec.Header().Get("X-Request-Id") == "" {
		t.Fatal("every response must carry a request id so a log line can be found from a client report")
	}
}
