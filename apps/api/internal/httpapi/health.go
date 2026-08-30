package httpapi

import (
	"net/http"

	"github.com/labstack/echo/v4"

	"github.com/chiempham/warp-work/internal/platform/postgres"
)

type healthResponse struct {
	Status string `json:"status"`
}

type readinessResponse struct {
	Status   string `json:"status"`
	Database string `json:"database"`
	Schema   string `json:"schema"`
	Applied  int64  `json:"applied_migration"`
	Expected int64  `json:"expected_migration"`
}

// live answers whether the process is running. It touches no dependency, so a
// database outage does not get the container killed and restarted pointlessly.
func (s *Server) live(c echo.Context) error {
	return c.JSON(http.StatusOK, healthResponse{Status: "ok"})
}

// ready answers whether the process can serve traffic: the database is
// reachable and its schema is at least as new as the one this binary was built
// against. A binary ahead of its database reports not-ready rather than failing
// requests one query at a time.
func (s *Server) ready(c echo.Context) error {
	ctx := c.Request().Context()

	body := readinessResponse{Status: "ok", Database: "ok", Schema: "ok"}
	status := http.StatusOK

	if err := s.pool.Ping(ctx); err != nil {
		body.Status, body.Database, body.Schema = "unavailable", "unreachable", "unknown"
		return c.JSON(http.StatusServiceUnavailable, body)
	}

	state, err := postgres.CheckSchema(ctx, s.pool)
	if err != nil {
		body.Status, body.Schema = "unavailable", "unknown"
		return c.JSON(http.StatusServiceUnavailable, body)
	}

	body.Applied, body.Expected = state.Applied, state.Embedded
	if !state.UpToDate() {
		body.Status, body.Schema = "unavailable", "pending migrations"
		status = http.StatusServiceUnavailable
	}
	return c.JSON(status, body)
}
