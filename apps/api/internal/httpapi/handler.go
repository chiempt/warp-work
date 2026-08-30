package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

	ht "github.com/ogen-go/ogen/http"
	"github.com/ogen-go/ogen/ogenerrors"

	"github.com/chiempham/warp-work/apps/api/internal/api"
	"github.com/chiempham/warp-work/internal/auth"
	"github.com/chiempham/warp-work/internal/config"
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

	cfg    config.Config
	pool   *postgres.Pool
	logger *slog.Logger
	auth   *auth.Service
}

// NewHandler wires the API implementation.
func NewHandler(cfg config.Config, logger *slog.Logger, pool *postgres.Pool, authSvc *auth.Service) *Handler {
	return &Handler{cfg: cfg, pool: pool, logger: logger, auth: authSvc}
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

// ogenRejection is anything ogen refused with a status of its own: a security
// scheme that did not resolve, a parameter that failed the schema. Taking its
// status keeps the response and the contract agreeing without a mapping table
// that has to be kept in step by hand.
type ogenRejection interface {
	error
	Code() int
}

// classify maps a Go error onto a status and a stable machine-readable code.
//
// Both error paths funnel through here — the one ogen uses for handler errors
// and security failures, and the one it uses for requests it rejected before
// an operation — so the API cannot answer the same condition two ways.
func classify(err error) (status int, code, message string) {
	var apiErr *APIError
	if errors.As(err, &apiErr) {
		return apiErr.Status, apiErr.Code, apiErr.Message
	}

	// No session, or one this server refused. Named before the generic ogen
	// case so the message can point at how to get one.
	if errors.Is(err, ErrNoSession) || isSecurityError(err) {
		return http.StatusUnauthorized, "unauthenticated",
			"this endpoint requires a session; sign in at /api/v1/auth/google/start"
	}

	// Described by the contract, not written yet. A promise the API has
	// published and not yet kept — never reported as the caller's mistake.
	if errors.Is(err, ht.ErrNotImplemented) {
		return http.StatusNotImplemented, "not_implemented",
			"this operation is described by the API contract but is not implemented yet"
	}

	// A domain validation failure is the caller's fault, not the server's.
	if errors.Is(err, domain.ErrInvalid) {
		return http.StatusUnprocessableEntity, "invalid", err.Error()
	}

	// Rejected against the spec: a missing required parameter, a malformed
	// uuid, a value outside its declared range. The message names the
	// parameter and is safe to return.
	var rejected ogenRejection
	if errors.As(err, &rejected) {
		return rejected.Code(), codeForStatus(rejected.Code()), rejected.Error()
	}

	// Anything unrecognised is a bug. Say nothing specific.
	return http.StatusInternalServerError, "internal", "internal error"
}

// isSecurityError reports whether ogen failed while resolving a security
// scheme — no cookie at all, or one securityHandler refused.
func isSecurityError(err error) bool {
	var secErr *ogenerrors.SecurityError
	return errors.As(err, &secErr)
}

// ogenErrorHandler answers requests that never reached an operation, plus the
// cases ogen deliberately routes here rather than to NewError.
func ogenErrorHandler(logger *slog.Logger) func(ctx context.Context, w http.ResponseWriter, r *http.Request, err error) {
	return func(ctx context.Context, w http.ResponseWriter, r *http.Request, err error) {
		status, code, message := classify(err)

		// Logged at debug when it is the caller's problem: a scanner probing
		// the API must not be able to fill the log at warn.
		level := slog.LevelDebug
		if status >= http.StatusInternalServerError {
			level = slog.LevelError
		}
		logger.Log(ctx, level, "request rejected before handling",
			slog.String("path", r.URL.Path),
			slog.Int("status", status),
			slog.String("error", err.Error()))

		writeEnvelope(w, status, code, message)
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
