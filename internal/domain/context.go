package domain

import "time"

// ContextColor is the accent a context is shown in. The values match the
// contexts_color_token CHECK constraint.
//
// These are hue names, not life areas, and that is the point: the tree already
// groups — a root context called "Work" with children under it is the grouping —
// so picking a colour must not require inventing a category first. There is no
// fixed set of life areas the owner has to file themselves under.
type ContextColor string

const (
	ContextSlate  ContextColor = "slate"
	ContextBlue   ContextColor = "blue"
	ContextViolet ContextColor = "violet"
	ContextGreen  ContextColor = "green"
	ContextTeal   ContextColor = "teal"
	ContextRose   ContextColor = "rose"
)

// Valid reports whether the colour is one the interface has a token for. An
// empty colour is valid and means the context is shown in the neutral tone.
func (c ContextColor) Valid() error {
	switch c {
	case "", ContextSlate, ContextBlue, ContextViolet, ContextGreen, ContextTeal, ContextRose:
		return nil
	default:
		return invalidf("context color %q", string(c))
	}
}

// Context is the central axis of the system. Every signal, task, person,
// memory note, and autonomy rule belongs to one. Contexts nest: a child
// inherits its parent's defaults unless it overrides them. Nesting is capped at
// three levels by the contexts_prevent_cycle trigger.
type Context struct {
	ID          ID
	UserID      ID
	ParentID    *ID
	Name        string
	Color       ContextColor
	ActiveHours ActiveHours
	ToneProfile string
	IsArchived  bool
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

func (c Context) Valid() error {
	if c.Name == "" {
		return invalidf("context name is empty")
	}
	if c.ParentID != nil && *c.ParentID == c.ID {
		return invalidf("context %s is its own parent", c.ID)
	}
	return c.Color.Valid()
}

// ActiveHours records when a context is allowed to surface, per weekday, in the
// owner's local timezone. An empty map means "always". This is what keeps
// coursework quiet at 10am on a workday.
type ActiveHours map[time.Weekday][]HourRange

// HourRange is a half-open [Start, End) range of minutes from midnight.
type HourRange struct {
	StartMinute int `json:"start_minute"`
	EndMinute   int `json:"end_minute"`
}

func (r HourRange) Valid() error {
	const minutesPerDay = 24 * 60
	switch {
	case r.StartMinute < 0 || r.StartMinute >= minutesPerDay:
		return invalidf("hour range start %d out of bounds", r.StartMinute)
	case r.EndMinute <= r.StartMinute || r.EndMinute > minutesPerDay:
		return invalidf("hour range end %d out of bounds", r.EndMinute)
	default:
		return nil
	}
}

// Active reports whether t falls inside the context's active hours. An empty
// ActiveHours is always active. t must already be in the presentation timezone;
// this package knows nothing about timezones.
func (a ActiveHours) Active(t time.Time) bool {
	if len(a) == 0 {
		return true
	}
	ranges, ok := a[t.Weekday()]
	if !ok {
		return false
	}
	minute := t.Hour()*60 + t.Minute()
	for _, r := range ranges {
		if minute >= r.StartMinute && minute < r.EndMinute {
			return true
		}
	}
	return false
}
