package domain

import "time"

// Reliability is how complete a source can be assumed to be. It is a
// first-class property because a report generated while a source was failing
// must never be silently trusted.
type Reliability string

const (
	// ReliabilityOfficial is a documented, supported provider API.
	ReliabilityOfficial Reliability = "official"
	// ReliabilityUnofficial is present for completeness only. Warp does not
	// build adapters against unofficial APIs — see CLAUDE.md, Connectors.
	ReliabilityUnofficial Reliability = "unofficial"
	// ReliabilityManual is entry by hand or by forwarding. Always available,
	// and the fallback every context must remain usable with.
	ReliabilityManual Reliability = "manual"
)

func (r Reliability) Valid() error {
	switch r {
	case ReliabilityOfficial, ReliabilityUnofficial, ReliabilityManual:
		return nil
	default:
		return invalidf("reliability %q", string(r))
	}
}

// Complete reports whether data from this source can be treated as the whole
// picture. Anything else must be marked in the interface.
func (r Reliability) Complete() bool { return r == ReliabilityOfficial }

// Provider identifies the external system behind an account.
type Provider string

const (
	ProviderGmail     Provider = "gmail"
	ProviderGCalendar Provider = "google_calendar"
	ProviderGDrive    Provider = "google_drive"
	ProviderZaloOA    Provider = "zalo_oa"
	ProviderManual    Provider = "manual"
)

func (p Provider) Valid() error {
	switch p {
	case ProviderGmail, ProviderGCalendar, ProviderGDrive, ProviderZaloOA, ProviderManual:
		return nil
	default:
		return invalidf("provider %q", string(p))
	}
}

// Reliability is a property of the provider, not of the account's health.
func (p Provider) Reliability() Reliability {
	switch p {
	case ProviderGmail, ProviderGCalendar, ProviderGDrive, ProviderZaloOA:
		return ReliabilityOfficial
	case ProviderManual:
		return ReliabilityManual
	default:
		return ReliabilityUnofficial
	}
}

// AccountStatus is the account's health right now, as distinct from the
// provider's reliability tier.
type AccountStatus string

const (
	AccountConnected    AccountStatus = "connected"
	AccountError        AccountStatus = "error"
	AccountDisconnected AccountStatus = "disconnected"
)

func (s AccountStatus) Valid() error {
	switch s {
	case AccountConnected, AccountError, AccountDisconnected:
		return nil
	default:
		return invalidf("account status %q", string(s))
	}
}

// Account is a connected source of signals.
type Account struct {
	ID          ID
	UserID      ID
	Provider    Provider
	Reliability Reliability
	DisplayName string
	Status      AccountStatus
	LastSyncAt  *time.Time
	LastError   string
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

func (a Account) Valid() error {
	if a.DisplayName == "" {
		return invalidf("account display name is empty")
	}
	if err := a.Provider.Valid(); err != nil {
		return err
	}
	if err := a.Reliability.Valid(); err != nil {
		return err
	}
	if a.Reliability == ReliabilityUnofficial {
		return invalidf("account %q uses an unofficial API; Warp does not build these", a.DisplayName)
	}
	return a.Status.Valid()
}

// Healthy reports whether the account is currently delivering signals.
func (a Account) Healthy() bool { return a.Status == AccountConnected }
