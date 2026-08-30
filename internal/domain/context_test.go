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
	c := domain.Context{ID: id, ParentID: &id, Name: "Self", Kind: domain.ContextPersonal}

	if err := c.Valid(); err == nil {
		t.Fatal("a context cannot be its own parent")
	}
}
