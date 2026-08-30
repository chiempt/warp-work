package domain

import "time"

// ContextKind partitions the owner's life areas. The values match the CHECK
// constraint on contexts.kind.
type ContextKind string

const (
	ContextWork     ContextKind = "work"
	ContextStudy    ContextKind = "study"
	ContextPersonal ContextKind = "personal"
)

func (k ContextKind) Valid() error {
	switch k {
	case ContextWork, ContextStudy, ContextPersonal:
		return nil
	default:
		return invalidf("context kind %q", string(k))
	}
}

// Context is the central axis of the system. Every signal, task, person,
// memory note, and autonomy rule belongs to one. Contexts nest: a child
// inherits its parent's defaults unless it overrides them.
type Context struct {
	ID          ID
	UserID      ID
	ParentID    *ID
	Name        string
	Kind        ContextKind
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
	return c.Kind.Valid()
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
