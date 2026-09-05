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

// ListContexts returns the owner's tree.
//
// The order is the query's — parents before children, then by position — and
// nothing here re-sorts it. The response has no error union: the spec declares
// only 200 and the default envelope, so a failure returns an error and NewError
// shapes it.
func (h *Handler) ListContexts(ctx context.Context, params api.ListContextsParams) (*api.ContextList, error) {
	principal, ok := principalFrom(ctx)
	if !ok {
		return nil, ErrNoSession
	}

	rows, err := h.contexts.List(ctx, principal.UserID, params.IncludeArchived.Or(false))
	if err != nil {
		return nil, err
	}

	items := make([]api.Context, 0, len(rows))
	for _, row := range rows {
		items = append(items, *contextResponse(row))
	}
	return &api.ContextList{Items: items}, nil
}

// GetContext returns one context.
//
// A context belonging to somebody else answers 404, not 403. Telling a caller
// that an id is real but not theirs is telling them it is real.
func (h *Handler) GetContext(ctx context.Context, params api.GetContextParams) (api.GetContextRes, error) {
	principal, ok := principalFrom(ctx)
	if !ok {
		return nil, ErrNoSession
	}

	row, err := h.contexts.Get(ctx, principal.UserID, params.ContextId)
	switch {
	case errors.Is(err, warpcontexts.ErrNotFound):
		return &api.ErrorEnvelope{Error: api.Error{
			Code:    "not_found",
			Message: "no such context",
		}}, nil
	case err != nil:
		return nil, err
	}
	return contextResponse(row), nil
}

// UpdateContext applies a partial change.
//
// The Set* flags carry the difference between a property the request left out
// and one it set to null: OptNil knows both, and the service needs both to tell
// "leave the colour alone" from "clear the colour".
func (h *Handler) UpdateContext(ctx context.Context, req *api.UpdateContextRequest, params api.UpdateContextParams) (api.UpdateContextRes, error) {
	principal, ok := principalFrom(ctx)
	if !ok {
		return nil, ErrNoSession
	}

	p := warpcontexts.UpdateParams{
		SetColor:       req.Color.IsSet(),
		Color:          optNilColor(req.Color),
		SetParentID:    req.ParentId.IsSet(),
		ParentID:       optNilUUID(req.ParentId),
		SetToneProfile: req.ToneProfile.IsSet(),
		ToneProfile:    optNilString(req.ToneProfile),
	}
	if req.Name.IsSet() {
		name := req.Name.Value
		p.Name = &name
	}
	if req.IsArchived.IsSet() {
		archived := req.IsArchived.Value
		p.IsArchived = &archived
	}

	row, err := h.contexts.Update(ctx, principal.UserID, params.ContextId, p)

	var liveChildren *warpcontexts.LiveChildrenError
	switch {
	case errors.Is(err, warpcontexts.ErrNotFound):
		return &api.UpdateContextNotFound{Error: api.Error{
			Code:    "not_found",
			Message: "no such context",
		}}, nil

	case errors.Is(err, warpcontexts.ErrNoParent):
		return &api.UpdateContextUnprocessableEntity{Error: api.Error{
			Code:    "no_such_parent",
			Message: "the parent context does not exist",
		}}, nil

	case errors.Is(err, warpcontexts.ErrSelfParent):
		return &api.UpdateContextUnprocessableEntity{Error: api.Error{
			Code:    "self_parent",
			Message: "a context cannot be nested under itself",
		}}, nil

	case errors.Is(err, warpcontexts.ErrCycle):
		return &api.UpdateContextUnprocessableEntity{Error: api.Error{
			Code: "cycle",
			Message: "a context cannot be nested under one of its own descendants; " +
				"move the descendant out first",
		}}, nil

	case errors.Is(err, warpcontexts.ErrTooDeep):
		return &api.UpdateContextUnprocessableEntity{Error: api.Error{
			Code:    "too_deep",
			Message: "contexts nest three levels deep at most",
		}}, nil

	case errors.As(err, &liveChildren):
		return &api.UpdateContextUnprocessableEntity{Error: api.Error{
			Code:    "live_children",
			Message: liveChildren.Error() + "; archive or move them first",
		}}, nil

	case err != nil:
		return nil, err
	}

	return contextResponse(row), nil
}

// ArchiveContext puts a context away. Nothing is deleted — see Service.Archive
// for why there is no operation that deletes one.
func (h *Handler) ArchiveContext(ctx context.Context, params api.ArchiveContextParams) (api.ArchiveContextRes, error) {
	principal, ok := principalFrom(ctx)
	if !ok {
		return nil, ErrNoSession
	}

	err := h.contexts.Archive(ctx, principal.UserID, params.ContextId)

	var liveChildren *warpcontexts.LiveChildrenError
	switch {
	case errors.Is(err, warpcontexts.ErrNotFound):
		return &api.ArchiveContextNotFound{Error: api.Error{
			Code:    "not_found",
			Message: "no such context",
		}}, nil

	case errors.As(err, &liveChildren):
		return &api.ArchiveContextConflict{Error: api.Error{
			Code:    "live_children",
			Message: liveChildren.Error() + "; archive or move them first",
		}}, nil

	case err != nil:
		return nil, err
	}

	return &api.ArchiveContextNoContent{}, nil
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

func optNilString(v api.OptNilString) *string {
	if !v.IsSet() || v.IsNull() {
		return nil
	}
	s := v.Value
	return &s
}

func optNilUUID(v api.OptNilUUID) *uuid.UUID {
	if !v.IsSet() || v.IsNull() {
		return nil
	}
	id := v.Value
	return &id
}

func optNilColor(v api.OptNilContextColor) *string {
	if !v.IsSet() || v.IsNull() {
		return nil
	}
	s := string(v.Value)
	return &s
}
