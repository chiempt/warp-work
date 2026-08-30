package httpapi

import (
	"errors"
	"log/slog"
	"net/http"

	"github.com/labstack/echo/v4"

	"github.com/chiempham/warp-work/internal/domain"
	"github.com/chiempham/warp-work/internal/platform/logging"
)

// Error is the single error shape the API returns, per docs/conventions.md §6.
type Error struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Details any    `json:"details,omitempty"`
}

type errorEnvelope struct {
	Error Error `json:"error"`
}

// APIError is an error with a status and a stable machine-readable code.
type APIError struct {
	Status  int
	Code    string
	Message string
	Details any
	cause   error
}

func (e *APIError) Error() string { return e.Message }
func (e *APIError) Unwrap() error { return e.cause }

// NewError builds an APIError. Message is shown to the caller, so it must not
// contain payload contents, credentials, or anyone's correspondence.
func NewError(status int, code, message string) *APIError {
	return &APIError{Status: status, Code: code, Message: message}
}

// WithCause attaches the underlying error for logging. The cause is never sent
// to the client.
func (e *APIError) WithCause(err error) *APIError {
	e.cause = err
	return e
}

// WithDetails attaches structured details that are safe to return.
func (e *APIError) WithDetails(details any) *APIError {
	e.Details = details
	return e
}

// Common errors.
func ErrNotFound(what string) *APIError {
	return NewError(http.StatusNotFound, "not_found", what+" not found")
}

func ErrBadRequest(message string) *APIError {
	return NewError(http.StatusBadRequest, "bad_request", message)
}

// errorHandler converts every error leaving a handler into the envelope above.
//
// It logs the cause at error level and returns only the safe message, so an
// internal failure cannot leak a payload or a connection string to the client.
func errorHandler(logger *slog.Logger) echo.HTTPErrorHandler {
	return func(err error, c echo.Context) {
		if c.Response().Committed {
			return
		}

		status, body := translate(err)

		if status >= http.StatusInternalServerError {
			logger.ErrorContext(c.Request().Context(), "request failed",
				slog.String("error", err.Error()),
				slog.String("path", c.Path()),
				slog.String("method", c.Request().Method),
				slog.String(logging.FieldRequestID, requestID(c)),
			)
		}

		if c.Request().Method == http.MethodHead {
			_ = c.NoContent(status)
			return
		}
		if writeErr := c.JSON(status, errorEnvelope{Error: body}); writeErr != nil {
			logger.ErrorContext(c.Request().Context(), "failed to write error response",
				slog.String("error", writeErr.Error()))
		}
	}
}

func translate(err error) (int, Error) {
	var apiErr *APIError
	if errors.As(err, &apiErr) {
		return apiErr.Status, Error{Code: apiErr.Code, Message: apiErr.Message, Details: apiErr.Details}
	}

	// A domain validation failure is the caller's fault, not the server's.
	if errors.Is(err, domain.ErrInvalid) {
		return http.StatusUnprocessableEntity, Error{Code: "invalid", Message: err.Error()}
	}

	var echoErr *echo.HTTPError
	if errors.As(err, &echoErr) {
		message, ok := echoErr.Message.(string)
		if !ok {
			message = http.StatusText(echoErr.Code)
		}
		return echoErr.Code, Error{Code: codeForStatus(echoErr.Code), Message: message}
	}

	// Anything unrecognised is a bug. Say nothing specific.
	return http.StatusInternalServerError, Error{Code: "internal", Message: "internal error"}
}

func codeForStatus(status int) string {
	switch status {
	case http.StatusNotFound:
		return "not_found"
	case http.StatusBadRequest:
		return "bad_request"
	case http.StatusMethodNotAllowed:
		return "method_not_allowed"
	case http.StatusRequestEntityTooLarge:
		return "payload_too_large"
	default:
		return "error"
	}
}
