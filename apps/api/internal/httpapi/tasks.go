package httpapi

import (
	"context"

	ht "github.com/ogen-go/ogen/http"

	"github.com/chiempham/warp-work/apps/api/internal/api"
)

// CreateTask records a task the owner wrote by hand.
//
// The signature is not a choice. ogen declares it in oas_server_gen.go from
// docs/api/openapi.yaml, and the assertion in handler.go turns any drift into a
// compile error here rather than a route that silently stops resolving.
//
// Note what this method does not do: it does not check the title, the priority
// range, or that contextId parses as a uuid. Those are declared in the contract
// and enforced by oas_validators_gen.go before the request reaches this line.
// Re-checking them would fork the contract into two copies that eventually
// disagree — and the handler's copy is the one no client can read.
func (h *Handler) CreateTask(ctx context.Context, req *api.CreateTaskRequest) (api.CreateTaskRes, error) {
	// Which account is asking comes from the session, never from the body.
	// That is the reason CreateTaskRequest carries no userId.
	if _, ok := principalFrom(ctx); !ok {
		return nil, ErrNoSession
	}

	// internal/workitem does not exist yet, so this answers 501 — a promise the
	// contract has published and not yet kept, which is exactly what that
	// status means. Returning a fabricated id instead would make the API report
	// success for a row that was never written.
	//
	// The shape this becomes:
	//
	//	task, err := h.workitem.CreateTask(ctx, principal.UserID, workitem.NewTask{...})
	//	if errors.Is(err, workitem.ErrContextNotFound) {
	//		return &api.CreateTaskNotFound{...}, nil
	//	}
	//	if err != nil {
	//		return nil, err
	//	}
	//	return toAPITask(task), nil
	return nil, ht.ErrNotImplemented
}
