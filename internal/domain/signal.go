package domain

import (
	"crypto/sha256"
	"encoding/hex"
	"time"
)

// SignalKind is the shape of the thing that arrived.
type SignalKind string

const (
	SignalEmail         SignalKind = "email"
	SignalMessage       SignalKind = "message"
	SignalCalendarEvent SignalKind = "calendar_event"
	SignalFile          SignalKind = "file"
)

func (k SignalKind) Valid() error {
	switch k {
	case SignalEmail, SignalMessage, SignalCalendarEvent, SignalFile:
		return nil
	default:
		return invalidf("signal kind %q", string(k))
	}
}

// Signal is one item as it arrived from the outside world, stored raw.
//
// Signals are immutable. Payload, ContentHash, ExternalID, AccountID, Kind and
// OccurredAt never change after insert — a database trigger enforces this, not
// only convention. ProcessedAt is a processing marker, not part of the record.
type Signal struct {
	ID          ID
	AccountID   ID
	ExternalID  string
	Kind        SignalKind
	Payload     []byte
	ContentHash string
	OccurredAt  time.Time
	IngestedAt  time.Time
	ProcessedAt *time.Time
}

func (s Signal) Valid() error {
	if s.ExternalID == "" {
		return invalidf("signal external id is empty")
	}
	if len(s.Payload) == 0 {
		return invalidf("signal %s has an empty payload", s.ExternalID)
	}
	if s.ContentHash != HashPayload(s.Payload) {
		return invalidf("signal %s content hash does not match its payload", s.ExternalID)
	}
	if s.OccurredAt.IsZero() {
		return invalidf("signal %s has no occurrence time", s.ExternalID)
	}
	return s.Kind.Valid()
}

// Processed reports whether extraction has already run over this signal.
func (s Signal) Processed() bool { return s.ProcessedAt != nil }

// HashPayload is the extraction cache key.
//
// It must be a pure function of the bytes: identical payloads hash identically
// across processes and across releases, so re-ingesting an unchanged item costs
// nothing and re-running extraction can skip it. Do not incorporate a
// timestamp, an ID, or a schema version here.
func HashPayload(payload []byte) string {
	sum := sha256.Sum256(payload)
	return hex.EncodeToString(sum[:])
}

// NewSignal builds a signal with its hash derived from the payload, so the two
// cannot disagree. now is supplied by the caller's Clock.
func NewSignal(id, accountID ID, kind SignalKind, externalID string, payload []byte, occurredAt time.Time, now time.Time) (Signal, error) {
	s := Signal{
		ID:          id,
		AccountID:   accountID,
		ExternalID:  externalID,
		Kind:        kind,
		Payload:     payload,
		ContentHash: HashPayload(payload),
		OccurredAt:  occurredAt.UTC(),
		IngestedAt:  now.UTC(),
	}
	if err := s.Valid(); err != nil {
		return Signal{}, err
	}
	return s, nil
}
