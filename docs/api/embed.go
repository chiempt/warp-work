// Package apidocs embeds the OpenAPI document so the running service can serve
// the exact contract it was built against.
//
// The file lives in docs/ rather than beside the code on purpose: it is the
// source of truth for the Go handlers and the TypeScript client alike, and it
// belongs where a person looks for documentation.
package apidocs

import _ "embed"

// Spec is the OpenAPI 3.0 document, served at /openapi.yaml.
//
//go:embed openapi.yaml
var Spec []byte
