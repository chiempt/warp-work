package domain_test

import (
	"testing"
	"time"

	"github.com/chiempham/warp-work/internal/domain"
)

func TestActiveHours_emptyMeansAlwaysActive(t *testing.T) {
	var hours domain.ActiveHours

	if !hours.Active(time.Date(2026, 8, 29, 3, 0, 0, 0, time.UTC)) {
		t.Fatal("a context with no active hours is always active")
	}
}

func TestActiveHours_keepsStudyQuietDuringWorkHours(t *testing.T) {
	// Coursework surfaces on weekday evenings only.
	hours := domain.ActiveHours{
		time.Monday: {{StartMinute: 19 * 60, EndMinute: 22 * 60}},
	}

	monday10am := time.Date(2026, 8, 31, 10, 0, 0, 0, time.UTC)
	monday8pm := time.Date(2026, 8, 31, 20, 0, 0, 0, time.UTC)
	tuesday8pm := time.Date(2026, 9, 1, 20, 0, 0, 0, time.UTC)

	if hours.Active(monday10am) {
		t.Error("coursework must stay quiet at 10am on a workday")
	}
	if !hours.Active(monday8pm) {
		t.Error("coursework should surface on Monday evening")
	}
	if hours.Active(tuesday8pm) {
		t.Error("a weekday with no configured range is inactive")
	}
}

func TestContext_rejectsSelfParenting(t *testing.T) {
	id := domain.MustNewID()
	c := domain.Context{ID: id, ParentID: &id, Name: "Self", Color: domain.ContextGreen}

	if err := c.Valid(); err == nil {
		t.Fatal("a context cannot be its own parent")
	}
}

// A context without a colour is shown in the neutral tone. That is a choice the
// owner is allowed to make, not a missing value, so it must validate.
func TestContextColor_emptyIsValid(t *testing.T) {
	if err := domain.ContextColor("").Valid(); err != nil {
		t.Fatalf("an uncoloured context is valid: %v", err)
	}
}

// The colour is a token name the interface has to resolve. Anything outside the
// set would reach the browser as a class that does not exist and render as no
// colour at all, so it is refused here as well as by contexts_color_token.
func TestContextColor_rejectsUnknownToken(t *testing.T) {
	for _, c := range []domain.ContextColor{"work", "#ff0000", "puce"} {
		if err := c.Valid(); err == nil {
			t.Errorf("color %q is not a token the interface can resolve", string(c))
		}
	}
}
