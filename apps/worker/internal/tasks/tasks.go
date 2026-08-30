// Package tasks names the background jobs and their payloads.
//
// Task type strings are a wire format: a queued job outlives the deploy that
// enqueued it. Renaming one strands whatever is already in Redis, so treat
// these constants as append-only.
package tasks

import (
	"github.com/google/uuid"
)

// Queues, highest priority first. asynq weights them; it does not starve the
// lower ones.
const (
	// QueueInteractive is work the owner is waiting on inside a session.
	QueueInteractive = "interactive"
	// QueueDefault is routine ingestion and extraction.
	QueueDefault = "default"
	// QueueBackfill is re-running extraction over history. It must never
	// delay the other two.
	QueueBackfill = "backfill"
)

// Weights are handed to asynq's server configuration.
func Weights() map[string]int {
	return map[string]int{
		QueueInteractive: 6,
		QueueDefault:     3,
		QueueBackfill:    1,
	}
}

// Task types. Phase 1 covers ingestion and routing only; extraction, agent
// runs, and execution arrive in later phases.
const (
	TypeAccountSync = "account:sync"
	TypeSignalRoute = "signal:route"
)

// AccountSyncPayload asks the worker to pull new items for one account.
//
// Sync is always a delta from the account's last cursor — a full re-fetch of a
// mailbox is a defect, not a fallback.
type AccountSyncPayload struct {
	AccountID uuid.UUID `json:"account_id"`
}

// SignalRoutePayload asks the worker to assign one signal to its contexts.
type SignalRoutePayload struct {
	SignalID uuid.UUID `json:"signal_id"`
}
