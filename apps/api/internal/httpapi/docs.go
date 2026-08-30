package httpapi

import (
	"net/http"

	"github.com/labstack/echo/v4"
	swgui "github.com/swaggest/swgui/v5emb"

	apidocs "github.com/chiempham/warp-work/docs/api"
)

// docsPath is where the browsable contract lives. specPath is the document
// itself, which is also what the frontend's client generator reads.
const (
	docsPath = "/docs"
	specPath = "/openapi.yaml"
)

// registerDocs serves the OpenAPI document and a Swagger UI over it.
//
// The document is embedded rather than read from disk, so what a running
// service documents is exactly the contract it was compiled against — a
// deployed binary cannot disagree with the spec sitting next to it. Swagger
// UI's assets are embedded too: the page works on a machine with no internet,
// and no CDN sees which endpoints are being read.
func (s *Server) registerDocs() {
	s.echo.GET(specPath, func(c echo.Context) error {
		return c.Blob(http.StatusOK, "application/yaml; charset=utf-8", apidocs.Spec)
	})

	ui := swgui.New("Warp API", specPath, docsPath)
	s.echo.GET(docsPath, echo.WrapHandler(ui))
	s.echo.GET(docsPath+"/*", echo.WrapHandler(ui))
}
