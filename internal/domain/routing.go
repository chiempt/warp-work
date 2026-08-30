package domain

import (
	"sort"
	"strings"
	"time"
)

// MatchType is how a routing rule recognises a signal. The order of the
// constants is the order the router tries them: cheapest first.
type MatchType string

const (
	MatchSender  MatchType = "sender"
	MatchDomain  MatchType = "domain"
	MatchThread  MatchType = "thread"
	MatchKeyword MatchType = "keyword"
)

func (m MatchType) Valid() error {
	switch m {
	case MatchSender, MatchDomain, MatchThread, MatchKeyword:
		return nil
	default:
		return invalidf("match type %q", string(m))
	}
}

// cost orders match types from cheapest to most expensive to evaluate.
func (m MatchType) cost() int {
	switch m {
	case MatchSender:
		return 0
	case MatchDomain:
		return 1
	case MatchThread:
		return 2
	case MatchKeyword:
		return 3
	default:
		return 4
	}
}

// RoutingRule assigns signals to a context without a model call. Most traffic
// resolves here, which is what keeps the token bill predictable.
type RoutingRule struct {
	ID         ID
	ContextID  ID
	MatchType  MatchType
	MatchValue string
	Priority   int
	IsActive   bool
	CreatedAt  time.Time
	UpdatedAt  time.Time
}

func (r RoutingRule) Valid() error {
	if r.MatchValue == "" {
		return invalidf("routing rule %s has an empty match value", r.ID)
	}
	return r.MatchType.Valid()
}

// Matches reports whether the rule recognises the given facts. Comparison is
// case-insensitive because email addresses and domains are.
func (r RoutingRule) Matches(f SignalFacts) bool {
	if !r.IsActive {
		return false
	}
	want := strings.ToLower(strings.TrimSpace(r.MatchValue))
	switch r.MatchType {
	case MatchSender:
		return strings.EqualFold(f.Sender, want)
	case MatchDomain:
		return strings.EqualFold(f.SenderDomain, want)
	case MatchThread:
		return f.ThreadID != "" && strings.EqualFold(f.ThreadID, want)
	case MatchKeyword:
		return strings.Contains(strings.ToLower(f.Subject+" "+f.Body), want)
	default:
		return false
	}
}

// SignalFacts is the normalised subset of a payload the router reasons over.
// Adapters produce it; the router never touches the raw payload.
type SignalFacts struct {
	Sender       string
	SenderDomain string
	ThreadID     string
	Subject      string
	Body         string
}

// AssignedBy records what decided a routing assignment, so a wrong assignment
// can be traced to the rule or the model call that made it.
type AssignedBy string

const (
	AssignedByRule   AssignedBy = "rule"
	AssignedByModel  AssignedBy = "model"
	AssignedByManual AssignedBy = "manual"
)

func (a AssignedBy) Valid() error {
	switch a {
	case AssignedByRule, AssignedByModel, AssignedByManual:
		return nil
	default:
		return invalidf("assigned by %q", string(a))
	}
}

// Assignment is one signal placed in one context.
type Assignment struct {
	SignalID   ID
	ContextID  ID
	Confidence float64
	AssignedBy AssignedBy
}

func (a Assignment) Valid() error {
	if a.Confidence < 0 || a.Confidence > 1 {
		return invalidf("confidence %v is outside [0,1]", a.Confidence)
	}
	return a.AssignedBy.Valid()
}

// MatchRules applies rules cheapest-first and returns the assignments the rules
// alone can justify. An empty result means the caller must escalate to a model
// call — it is the only path that costs tokens, and it is the last one.
//
// Rules are sorted by match cost, then by explicit priority, then by ID, so the
// outcome does not depend on the order rows came back from the database.
func MatchRules(facts SignalFacts, signalID ID, rules []RoutingRule) []Assignment {
	ordered := make([]RoutingRule, len(rules))
	copy(ordered, rules)
	sort.SliceStable(ordered, func(i, j int) bool {
		a, b := ordered[i], ordered[j]
		if a.MatchType.cost() != b.MatchType.cost() {
			return a.MatchType.cost() < b.MatchType.cost()
		}
		if a.Priority != b.Priority {
			return a.Priority < b.Priority
		}
		return a.ID.String() < b.ID.String()
	})

	seen := make(map[ID]bool, len(ordered))
	var out []Assignment
	for _, r := range ordered {
		if seen[r.ContextID] || !r.Matches(facts) {
			continue
		}
		seen[r.ContextID] = true
		out = append(out, Assignment{
			SignalID:   signalID,
			ContextID:  r.ContextID,
			Confidence: 1,
			AssignedBy: AssignedByRule,
		})
	}
	return out
}
