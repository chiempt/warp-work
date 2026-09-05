package httpapi

import (
	"context"
	"errors"

	"github.com/google/uuid"

	"github.com/chiempham/warp-work/apps/api/internal/api"
	warpcontexts "github.com/chiempham/warp-work/internal/contexts"
	"github.com/chiempham/warp-work/internal/store"
)

// CreateContext adds a life area.
//
// The owner comes from the session, never from the request. There is one owner,
// and which one it is is not something a caller gets to assert.
//
// Slug format, name length and the colour enum are already enforced by the
// contract, so nothing here re-checks them: a handler that repeats what the
// schema declares has forked the contract, and the two drift the first time one
// is edited.
func (h *Handler) CreateContext(ctx context.Context, req *api.CreateContextRequest) (api.CreateContextRes, error) {
	principal, ok := principalFrom(ctx)
	if !ok {
		return nil, ErrNoSession
	}

	var parentID *uuid.UUID
	if req.ParentId.IsSet() && !req.ParentId.IsNull() {
		id := req.ParentId.Value
		parentID = &id
	}

	row, err := h.contexts.Create(ctx, principal.UserID, warpcontexts.CreateParams{
		Slug:        req.Slug,
		Name:        req.Name,
		ParentID:    parentID,
		Color:       optNilColor(req.Color),
		ToneProfile: optString(req.ToneProfile),
	})

	switch {
	case errors.Is(err, warpcontexts.ErrSlugTaken):
		return &api.CreateContextConflict{Error: api.Error{
			Code:    "slug_taken",
			Message: "a context with that slug already exists; slugs are what routing rules refer to, so they are not reused",
		}}, nil

	case errors.Is(err, warpcontexts.ErrNoParent):
		return &api.CreateContextUnprocessableEntity{Error: api.Error{
			Code:    "no_such_parent",
			Message: "the parent context does not exist",
		}}, nil

	case err != nil:
		// Anything else is ours. NewError logs it and says nothing specific.
		return nil, err
	}

	return contextResponse(row), nil
}

// contextResponse maps a stored row onto the contract's shape. The mapping is
// explicit rather than a struct tag on the store type: the database is free to
// grow a column without it appearing in the API by accident.
func contextResponse(row store.Context) *api.Context {
	out := &api.Context{
		ID:         row.ID,
		Slug:       row.Slug,
		Name:       row.Name,
		Position:   row.Position,
		IsArchived: row.IsArchived,
		CreatedAt:  row.CreatedAt.Time.UTC(),
		UpdatedAt:  row.UpdatedAt.Time.UTC(),
	}

	if row.ParentID != nil {
		out.ParentId = api.NewOptNilUUID(*row.ParentID)
	}
	if row.Color != nil {
		out.Color = api.NewOptNilContextColor(api.ContextColor(*row.Color))
	}
	if row.ToneProfile != nil {
		out.ToneProfile = api.NewOptString(*row.ToneProfile)
	}
	return out
}

func optString(v api.OptString) *string {
	if !v.IsSet() {
		return nil
	}
	s := v.Value
	return &s
}

func optNilColor(v api.OptNilContextColor) *string {
	if !v.IsSet() || v.IsNull() {
		return nil
	}
	s := string(v.Value)
	return &s
}
