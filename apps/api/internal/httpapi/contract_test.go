package httpapi_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

// envelope is the one error shape the API is allowed to emit.
type envelope struct {
	Error struct {
		Code    string `json:"code"`
		Message string `json:"message"`
	} `json:"error"`
}

func get(t *testing.T, path string) (int, envelope) {
	t.Helper()
	rec := httptest.NewRecorder()
	newServer(t).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, path, nil))

	var body envelope
	if rec.Body.Len() > 0 {
		if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
			t.Fatalf("%s: response is not the error envelope: %v (%s)", path, err, rec.Body.String())
		}
	}
	return rec.Code, body
}

// The contract is served by the binary that implements it, so a deployed
// service cannot document something other than what it runs.
func TestSpecIsServed(t *testing.T) {
	rec := httptest.NewRecorder()
	newServer(t).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/openapi.yaml", nil))

	if rec.Code != http.StatusOK {
		t.Fatalf("want 200, got %d", rec.Code)
	}
	if got := rec.Header().Get("Content-Type"); got == "" {
		t.Error("the spec must be served with a content type")
	}
	if rec.Body.Len() == 0 {
		t.Fatal("the spec is empty; is docs/api/openapi.yaml embedded?")
	}
}

func TestDocsUIIsServed(t *testing.T) {
	rec := httptest.NewRecorder()
	newServer(t).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/docs", nil))

	if rec.Code != http.StatusOK {
		t.Fatalf("want 200, got %d", rec.Code)
	}
}

// An operation the contract promises but that is not written yet must say so.
// Reporting it as a client error would send someone hunting through their own
// request for a fault that is ours.
func TestUnimplementedOperation_is501(t *testing.T) {
	status, body := get(t, "/api/v1/contexts")

	if status != http.StatusNotImplemented {
		t.Fatalf("want 501, got %d", status)
	}
	if body.Error.Code != "not_implemented" {
		t.Errorf("want code not_implemented, got %q", body.Error.Code)
	}
}

// These cases are rejected by generated code, from the spec — no handler runs.
// The point of the test is that the rejection still arrives in our envelope.
func TestContractViolations_areRejectedInTheEnvelope(t *testing.T) {
	tests := []struct {
		name string
		path string
	}{
		{
			// Hard invariant 2: there is no unfiltered signal listing, and the
			// contract is what enforces it.
			name: "signals without contextIds",
			path: "/api/v1/signals",
		},
		{
			name: "context id that is not a uuid",
			path: "/api/v1/signals?contextIds=not-a-uuid",
		},
		{
			name: "limit above the declared maximum",
			path: "/api/v1/signals?contextIds=0192a5bb-0000-7000-8000-000000000001&limit=999",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			status, body := get(t, tt.path)

			if status != http.StatusBadRequest {
				t.Fatalf("want 400, got %d", status)
			}
			if body.Error.Code != "bad_request" {
				t.Errorf("want code bad_request, got %q", body.Error.Code)
			}
			if body.Error.Message == "" {
				t.Error("the message must name what was wrong with the request")
			}
		})
	}
}

func TestUnknownEndpoint_is404InTheEnvelope(t *testing.T) {
	status, body := get(t, "/api/v1/nope")

	if status != http.StatusNotFound {
		t.Fatalf("want 404, got %d", status)
	}
	if body.Error.Code != "not_found" {
		t.Errorf("want code not_found, got %q", body.Error.Code)
	}
}

func TestWrongMethod_is405WithAllow(t *testing.T) {
	rec := httptest.NewRecorder()
	newServer(t).ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/api/v1/contexts", nil))

	if rec.Code != http.StatusMethodNotAllowed {
		t.Fatalf("want 405, got %d", rec.Code)
	}
	if rec.Header().Get("Allow") == "" {
		t.Error("a 405 must say which methods are allowed")
	}
}
