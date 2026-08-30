package domain_test

import (
	"testing"

	"github.com/chiempham/warp/internal/domain"
)

func facts() domain.SignalFacts {
	return domain.SignalFacts{
		Sender:       "supervisor@uni.edu.vn",
		SenderDomain: "uni.edu.vn",
		ThreadID:     "thread-9",
		Subject:      "Thesis draft feedback",
		Body:         "Please send the revised chapter by Friday.",
	}
}

func rule(ctxID domain.ID, mt domain.MatchType, value string, priority int) domain.RoutingRule {
	return domain.RoutingRule{
		ID:         domain.MustNewID(),
		ContextID:  ctxID,
		MatchType:  mt,
		MatchValue: value,
		Priority:   priority,
		IsActive:   true,
	}
}

func TestMatchRules_prefersTheCheapestMatchType(t *testing.T) {
	study := domain.MustNewID()
	work := domain.MustNewID()

	// The keyword rule is listed first and has a better priority, but sender is
	// the cheaper match type and must win the ordering.
	got := domain.MatchRules(facts(), domain.MustNewID(), []domain.RoutingRule{
		rule(work, domain.MatchKeyword, "chapter", 1),
		rule(study, domain.MatchSender, "supervisor@uni.edu.vn", 100),
	})

	if len(got) != 2 {
		t.Fatalf("want both rules to match, got %d", len(got))
	}
	if got[0].ContextID != study {
		t.Error("the sender rule should be evaluated before the keyword rule")
	}
	for _, a := range got {
		if a.AssignedBy != domain.AssignedByRule {
			t.Errorf("rule matches must be attributed to a rule, got %q", a.AssignedBy)
		}
		if a.Confidence != 1 {
			t.Errorf("a rule match is certain, got confidence %v", a.Confidence)
		}
	}
}

func TestMatchRules_assignsEachContextOnce(t *testing.T) {
	study := domain.MustNewID()

	got := domain.MatchRules(facts(), domain.MustNewID(), []domain.RoutingRule{
		rule(study, domain.MatchSender, "supervisor@uni.edu.vn", 1),
		rule(study, domain.MatchDomain, "uni.edu.vn", 2),
	})

	if len(got) != 1 {
		t.Fatalf("two rules for one context must produce one assignment, got %d", len(got))
	}
}

func TestMatchRules_ignoresInactiveRules(t *testing.T) {
	r := rule(domain.MustNewID(), domain.MatchSender, "supervisor@uni.edu.vn", 1)
	r.IsActive = false

	if got := domain.MatchRules(facts(), domain.MustNewID(), []domain.RoutingRule{r}); len(got) != 0 {
		t.Fatalf("an inactive rule must not match, got %d assignments", len(got))
	}
}

// No rule matching is the only condition under which the router may spend
// tokens, so it has to be unambiguous.
func TestMatchRules_returnsNothingWhenNoRuleMatches(t *testing.T) {
	r := rule(domain.MustNewID(), domain.MatchDomain, "client-a.com", 1)

	if got := domain.MatchRules(facts(), domain.MustNewID(), []domain.RoutingRule{r}); len(got) != 0 {
		t.Fatalf("want no assignments so the caller escalates to a model, got %d", len(got))
	}
}

func TestMatchRules_isDeterministicRegardlessOfInputOrder(t *testing.T) {
	a, b := domain.MustNewID(), domain.MustNewID()
	r1 := rule(a, domain.MatchDomain, "uni.edu.vn", 5)
	r2 := rule(b, domain.MatchDomain, "uni.edu.vn", 5)

	forward := domain.MatchRules(facts(), domain.MustNewID(), []domain.RoutingRule{r1, r2})
	reverse := domain.MatchRules(facts(), domain.MustNewID(), []domain.RoutingRule{r2, r1})

	if len(forward) != len(reverse) {
		t.Fatalf("input order changed the number of assignments: %d vs %d", len(forward), len(reverse))
	}
	for i := range forward {
		if forward[i].ContextID != reverse[i].ContextID {
			t.Fatal("input order changed the assignment order")
		}
	}
}
