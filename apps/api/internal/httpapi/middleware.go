package httpapi

import (
	"log/slog"
	"time"

	"github.com/labstack/echo/v4"
	echomw "github.com/labstack/echo/v4/middleware"

	"github.com/chiempham/warp-work/internal/platform/logging"
)

const headerRequestID = echo.HeaderXRequestID

func requestID(c echo.Context) string {
	return c.Response().Header().Get(headerRequestID)
}

// requestLogger emits one structured line per request and puts the logger,
// already carrying the request id, into the request context so handlers can
// annotate it with context_id, session_id, and run_id.
func requestLogger(logger *slog.Logger) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			start := time.Now()

			reqLogger := logger.With(slog.String(logging.FieldRequestID, requestID(c)))
			req := c.Request()
			c.SetRequest(req.WithContext(logging.Into(req.Context(), reqLogger)))

			err := next(c)
			if err != nil {
				// Let the error handler decide the status, then log below.
				c.Error(err)
			}

			reqLogger.LogAttrs(c.Request().Context(), slog.LevelInfo, "request",
				slog.String("method", req.Method),
				slog.String("path", c.Path()),
				slog.Int("status", c.Response().Status),
				slog.Duration("took", time.Since(start)),
			)
			// The error has been handled; returning it again would double-write.
			return nil
		}
	}
}

func defaultMiddleware(logger *slog.Logger) []echo.MiddlewareFunc {
	return []echo.MiddlewareFunc{
		echomw.RequestID(),
		requestLogger(logger),
		echomw.Recover(),
		echomw.BodyLimit("2M"),
	}
}
