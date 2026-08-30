// Package httpapi builds the Echo server.
//
// Handlers here are thin: they parse, delegate to a service, and render. The
// generated OpenAPI interfaces (docs/api/openapi.yaml) will replace the manual
// route registration below once the first real endpoint exists.
package httpapi

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"

	"github.com/labstack/echo/v4"

	"github.com/chiempham/warp/internal/config"
	"github.com/chiempham/warp/internal/platform/postgres"
)

// Server owns the HTTP listener and its dependencies.
type Server struct {
	echo   *echo.Echo
	cfg    config.Config
	logger *slog.Logger
	pool   *postgres.Pool
}

// New wires the server. It does not listen; call Start for that.
func New(cfg config.Config, logger *slog.Logger, pool *postgres.Pool) *Server {
	e := echo.New()
	e.HideBanner = true
	e.HidePort = true
	e.HTTPErrorHandler = errorHandler(logger)

	s := &Server{echo: e, cfg: cfg, logger: logger, pool: pool}

	e.Use(defaultMiddleware(logger)...)
	s.routes()
	return s
}

func (s *Server) routes() {
	// Operational endpoints sit outside the versioned API: they are for the
	// container runtime, not for clients.
	s.echo.GET("/healthz", s.live)
	s.echo.GET("/readyz", s.ready)

	v1 := s.echo.Group("/api/v1")

	// Every list endpoint here must be context-scoped. There is no unfiltered
	// GET /api/v1/signals — see CLAUDE.md, hard invariant 2.
	_ = v1
}

// Start listens until ctx is cancelled, then drains in-flight requests.
func (s *Server) Start(ctx context.Context) error {
	addr := fmt.Sprintf(":%d", s.cfg.API.Port)

	errs := make(chan error, 1)
	go func() {
		s.logger.Info("api listening", slog.String("addr", addr), slog.String("env", string(s.cfg.Env)))
		if err := s.echo.Start(addr); err != nil && err != http.ErrServerClosed {
			errs <- err
		}
		close(errs)
	}()

	select {
	case err := <-errs:
		return err
	case <-ctx.Done():
	}

	shutdownCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), s.cfg.API.ShutdownTimeout)
	defer cancel()

	s.logger.Info("api draining", slog.Duration("timeout", s.cfg.API.ShutdownTimeout))
	if err := s.echo.Shutdown(shutdownCtx); err != nil {
		return fmt.Errorf("shutdown: %w", err)
	}
	return nil
}

// Handler exposes the router for tests.
func (s *Server) Handler() http.Handler { return s.echo }
