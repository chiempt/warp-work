package domain_test

import (
	"testing"
	"time"

	"github.com/chiempham/warp-work/internal/domain"
)

func TestHashPayload_isStableAcrossCalls(t *testing.T) {
	payload := []byte(`{"subject":"Invoice","from":"a@example.com"}`)

	first := domain.HashPayload(payload)
	second := domain.HashPayload(payload)

	if first != second {
		t.Fatalf("hash is not deterministic: %q then %q", first, second)
	}
	if len(first) != 64 {
		t.Fatalf("want a 64-character sha256 hex digest, got %d characters", len(first))
	}
}

func TestHashPayload_distinguishesPayloads(t *testing.T) {
	a := domain.HashPayload([]byte(`{"subject":"Invoice"}`))
	b := domain.HashPayload([]byte(`{"subject":"invoice"}`))

	if a == b {
		t.Fatal("payloads differing by one byte hashed identically")
	}
}

func TestNewSignal_derivesHashAndNormalisesToUTC(t *testing.T) {
	jakarta := time.FixedZone("WIB", 7*60*60)
	occurred := time.Date(2026, 8, 29, 14, 30, 0, 0, jakarta)
	now := time.Date(2026, 8, 29, 8, 0, 0, 0, time.UTC)
	payload := []byte(`{"id":"m1"}`)

	s, err := domain.NewSignal(domain.MustNewID(), domain.MustNewID(), domain.SignalEmail, "m1", payload, occurred, now)
	if err != nil {
		t.Fatalf("NewSignal: %v", err)
	}

	if s.ContentHash != domain.HashPayload(payload) {
		t.Error("content hash was not derived from the payload")
	}
	if s.OccurredAt.Location() != time.UTC || s.IngestedAt.Location() != time.UTC {
		t.Error("timestamps must be stored in UTC")
	}
	if s.Processed() {
		t.Error("a freshly ingested signal must not be marked processed")
	}
}

func TestSignal_rejectsATamperedHash(t *testing.T) {
	s, err := domain.NewSignal(domain.MustNewID(), domain.MustNewID(), domain.SignalEmail, "m1", []byte(`{"id":"m1"}`), time.Now(), time.Now())
	if err != nil {
		t.Fatalf("NewSignal: %v", err)
	}

	s.Payload = []byte(`{"id":"m1","injected":true}`)

	if err := s.Valid(); err == nil {
		t.Fatal("a payload edited after hashing must not validate")
	}
}
