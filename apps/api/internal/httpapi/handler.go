package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

	ht "github.com/ogen-go/ogen/http"

	"github.com/chiempham/warp-work/apps/api/internal/api"
	"github.com/chiempham/warp-work/internal/domain"
	"github.com/chiempham/warp-work/internal/platform/postgres"
)

// Handler implements the generated api.Handler interface.
//
// It embeds api.UnimplementedHandler, so an operation that exists in the spec
// but has no implementation yet answers 501 rather than failing to compile.
// That is what makes it possible to publish the whole contract first and fill
// it in operation by operation — and adding an operation to the spec still
// cannot break the build.
type Handler struct {
	api.UnimplementedHandler

	pool   *postgres.Pool
	logger *slog.Logger
}

// NewHandler wires the API implementation.
func NewHandler(logger *slog.Logger, pool *postgres.Pool) *Handler {
	return &Handler{pool: pool, logger: logger}
}

var _ api.Handler = (*Handler)(nil)

// NewError converts an error returned by an operation into the response
// envelope. Every error the API emits passes through here, which is the reason
// there is exactly one error shape to document and one branch for a client to
// write.
//
// The cause is logged, never returned: an internal failure must not leak a
// query, a connection string, or a fragment of someone's correspondence.
func (h *Handler) NewError(ctx context.Context, err error) *api.ErrorStatusCode {
	status, code, message := classify(err)

	if status >= http.StatusInternalServerError {
		h.logger.ErrorContext(ctx, "request failed", slog.String("error", err.Error()))
	}

	return &api.ErrorStatusCode{
		StatusCode: status,
		Response: api.ErrorEnvelope{
			Error: api.Error{Code: code, Message: message},
		},
	}
}

// classify maps a Go error onto a status and a stable machine-readable code.
func classify(err error) (status int, code, message string) {
	var apiErr *APIError
	if errors.As(err, &apiErr) {
		return apiErr.Status, apiErr.Code, apiErr.Message
	}

	// An operation that is in the spec but not yet written.
	if errors.Is(err, ht.ErrNotImplemented) {
		return http.StatusNotImplemented, "not_implemented",
			"this operation is described by the API contract but is not implemented yet"
	}

	// A domain validation failure is the caller's fault, not the server's.
	if errors.Is(err, domain.ErrInvalid) {
		return http.StatusUnprocessableEntity, "invalid", err.Error()
	}

	// Anything unrecognised is a bug. Say nothing specific.
	return http.StatusInternalServerError, "internal", "internal error"
}

// ogenErrorHandler answers requests that never reached an operation, plus the
// one case ogen deliberately routes here instead of to NewError: an operation
// that returns ht.ErrNotImplemented.
//
// Both still have to leave as the same envelope, or a client would need a
// second error branch for exactly these paths.
func ogenErrorHandler(logger *slog.Logger) func(ctx context.Context, w http.ResponseWriter, r *http.Request, err error) {
	return func(ctx context.Context, w http.ResponseWriter, r *http.Request, err error) {
		// Described by the contract, not written yet. This is a promise the
		// API has published and not yet kept, so it must not be reported as a
		// client mistake.
		if errors.Is(err, ht.ErrNotImplemented) {
			writeEnvelope(w, http.StatusNotImplemented, "not_implemented",
				"this operation is described by the API contract but is not implemented yet")
			return
		}

		// Otherwise ogen rejected the request against the spec before it became
		// an operation: a missing required parameter, a malformed uuid, a value
		// outside its declared range. The message names the parameter and is
		// safe to return.
		//
		// Logged at debug on purpose: a scanner probing the API must not be
		// able to fill the log at warn.
		logger.DebugContext(ctx, "request rejected against the contract",
			slog.String("path", r.URL.Path),
			slog.String("error", err.Error()))

		writeEnvelope(w, http.StatusBadRequest, "bad_request", err.Error())
	}
}

// notFoundHandler answers a path that is not in the contract.
func notFoundHandler(w http.ResponseWriter, r *http.Request) {
	writeEnvelope(w, http.StatusNotFound, "not_found",
		"no such endpoint; see /docs for the API contract")
}

// methodNotAllowedHandler answers a known path with the wrong method.
func methodNotAllowedHandler(w http.ResponseWriter, r *http.Request, allowed string) {
	w.Header().Set("Allow", allowed)
	writeEnvelope(w, http.StatusMethodNotAllowed, "method_not_allowed",
		"this endpoint accepts "+allowed)
}

func writeEnvelope(w http.ResponseWriter, status int, code, message string) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(errorEnvelope{Error: Error{Code: code, Message: message}})
}
