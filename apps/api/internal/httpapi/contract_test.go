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

func request(t *testing.T, method, path string) (int, envelope) {
	t.Helper()
	rec := httptest.NewRecorder()
	newServer(t).ServeHTTP(rec, httptest.NewRequest(method, path, nil))

	var body envelope
	if rec.Body.Len() > 0 {
		if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
			t.Fatalf("%s %s: response is not the error envelope: %v (%s)",
				method, path, err, rec.Body.String())
		}
	}
	return rec.Code, body
}

func get(t *testing.T, path string) (int, envelope) {
	t.Helper()
	return request(t, http.MethodGet, path)
}

// The contract is served by the binary that implements it, so a deployed
// service cannot document something other than what it runs.
func TestSpecIsServed(t *testing.T) {
	rec := httptest.NewRecorder()
	newServer(t).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/openapi.yaml", nil))

	if rec.Code != http.StatusOK {
		t.Fatalf("want 200, got %d", rec.Code)
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

// The contract declares a global security requirement, so an endpoint that
// forgets to opt out is protected by default rather than by remembering.
func TestSecuredEndpoints_withoutSession_are401(t *testing.T) {
	for _, path := range []string{
		"/api/v1/contexts",
		"/api/v1/accounts",
		"/api/v1/auth/session",
		"/api/v1/auth/sessions",
		"/api/v1/auth/providers",
	} {
		t.Run(path, func(t *testing.T) {
			status, body := get(t, path)

			if status != http.StatusUnauthorized {
				t.Fatalf("want 401, got %d", status)
			}
			if body.Error.Code != "unauthenticated" {
				t.Errorf("want code unauthenticated, got %q", body.Error.Code)
			}
		})
	}
}

// Security resolves before parameters are decoded. `/signals` has a required
// parameter and is missing it here, yet the answer is 401 rather than 400 — an
// unauthenticated caller learns nothing about the shape of the endpoint.
func TestSecurityIsCheckedBeforeValidation(t *testing.T) {
	status, body := get(t, "/api/v1/signals")

	if status != http.StatusUnauthorized {
		t.Fatalf("want 401 rather than a parameter error, got %d", status)
	}
	if body.Error.Code != "unauthenticated" {
		t.Errorf("want code unauthenticated, got %q", body.Error.Code)
	}
}

// Signing in cannot require a session. These two opt out with `security: []`,
// and reaching the handler at all is what proves the opt-out took effect.
func TestSignInEndpointsAreReachableWithoutASession(t *testing.T) {
	status, body := get(t, "/api/v1/auth/google/start")

	if status != http.StatusNotImplemented {
		t.Fatalf("want 501 — reached the handler, not yet written — got %d", status)
	}
	if body.Error.Code != "not_implemented" {
		t.Errorf("want code not_implemented, got %q", body.Error.Code)
	}
}

// These are rejected by generated code, from the spec — no handler runs. The
// point is that the rejection still arrives in our envelope.
func TestContractViolations_areRejectedInTheEnvelope(t *testing.T) {
	tests := []struct {
		name string
		path string
	}{
		{
			name: "callback without the required code and state",
			path: "/api/v1/auth/google/callback",
		},
		{
			// The pattern on returnTo rejects a protocol-relative URL, so the
			// sign-in redirect cannot be turned into an open redirect. No
			// handler code enforces this — the schema does.
			name: "returnTo pointing off-site",
			path: "/api/v1/auth/google/start?returnTo=//evil.example.com",
		},
		{
			name: "returnTo as an absolute URL",
			path: "/api/v1/auth/google/start?returnTo=https://evil.example.com",
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

// A path outside the contract is answered by routing, before security.
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
