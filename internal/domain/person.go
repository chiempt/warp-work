package domain

import "time"

// Person is a human the owner deals with. One person is reachable through
// several identities; one account may carry many people.
type Person struct {
	ID          ID
	UserID      ID
	DisplayName string
	Notes       string
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

func (p Person) Valid() error {
	if p.DisplayName == "" {
		return invalidf("person display name is empty")
	}
	return nil
}

// Identity links a person to one handle on one provider — an email address, a
// Zalo ID, a phone number. Verified means the owner confirmed the link rather
// than the system inferring it.
type Identity struct {
	ID       ID
	PersonID ID
	Provider Provider
	Handle   string
	Verified bool
}

func (i Identity) Valid() error {
	if i.Handle == "" {
		return invalidf("identity handle is empty")
	}
	return i.Provider.Valid()
}
