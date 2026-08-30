package domain_test

import (
	"errors"
	"testing"

	"github.com/chiempham/warp-work/internal/domain"
)

func TestAccount_refusesUnofficialProviders(t *testing.T) {
	a := domain.Account{
		ID:          domain.MustNewID(),
		UserID:      domain.MustNewID(),
		Provider:    domain.ProviderGmail,
		Reliability: domain.ReliabilityUnofficial,
		DisplayName: "personal zalo",
		Status:      domain.AccountConnected,
	}

	err := a.Valid()
	if err == nil {
		t.Fatal("an account on an unofficial API must not validate")
	}
	if !errors.Is(err, domain.ErrInvalid) {
		t.Errorf("want ErrInvalid, got %v", err)
	}
}

func TestProvider_reliabilityTiers(t *testing.T) {
	tests := []struct {
		provider domain.Provider
		want     domain.Reliability
	}{
		{domain.ProviderGmail, domain.ReliabilityOfficial},
		{domain.ProviderGCalendar, domain.ReliabilityOfficial},
		{domain.ProviderZaloOA, domain.ReliabilityOfficial},
		{domain.ProviderManual, domain.ReliabilityManual},
	}

	for _, tt := range tests {
		if got := tt.provider.Reliability(); got != tt.want {
			t.Errorf("%s: want %s, got %s", tt.provider, tt.want, got)
		}
	}
}

// Only an official source may be presented as the complete picture; everything
// else has to be marked in the interface.
func TestReliability_completeness(t *testing.T) {
	if !domain.ReliabilityOfficial.Complete() {
		t.Error("official sources are complete")
	}
	if domain.ReliabilityManual.Complete() {
		t.Error("manual sources must be marked incomplete")
	}
}
