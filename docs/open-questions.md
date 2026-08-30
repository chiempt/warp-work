# Open questions

Unresolved design questions from context document §11, with the phase each one blocks. An agent that
hits one of these picks a defensible default, marks it `TODO(open-question-N)` in the code, and says
which default it chose.

Answering one means editing this file *and* the context document, and writing an ADR if the answer
constrains later work.

---

### 1. Routing confidence threshold

Below what confidence does a signal go to a manual routing queue instead of being auto-assigned?

**Blocks:** Phase 2. Until answered, every model-assigned route is auto-accepted and the misfiling
rate is unmeasured.
**Needs:** a few hundred routed signals with a recorded confidence, and a count of how many were
wrong. Cannot be answered from first principles.
**Working default:** auto-assign above 0.8, manual queue below. Log everything.

### 2. Autonomy upgrade threshold

How many consecutive `approved_unchanged` outcomes should trigger an upgrade proposal — and should
the threshold scale with how damaging the action is?

**Blocks:** Phase 4 only.
**Leaning:** yes, it should scale. Sending an email to the main company job and updating an internal
record are not the same risk, and a single threshold would have to be set for the worst case, making
the ladder useless for everything else.

### 3. Automatic vs confirmed commitment extraction

Should commitments be extracted automatically, or confirmed by the owner on first detection until
precision has been measured?

**Blocks:** Phase 2. This is the highest-value table in the system, and a false commitment is worse
than a missed one — it erodes trust in the whole record.
**Working default:** confirm on first detection. Flip to automatic once precision is measured on real
traffic, per context.

### 4. Signal payload retention

How long are raw payloads kept before being pruned to metadata?

**Blocks:** nothing yet, but it gets more expensive to answer every month. Raw payloads are what makes
re-running improved extraction over history possible — pruning them forecloses that.
**Note:** whatever the answer, `content_hash`, `occurred_at`, and the derived records survive pruning.

### 5. Token budget

What is the acceptable monthly spend, and what does the system do when it is exceeded mid-session?

**Blocks:** Phase 3.
**Needs:** a measured cost per signal through the ADR 0003 tiering, which needs Phase 2 running.
**Design constraint regardless of the number:** exceeding the budget must degrade, not fail. Routing
and extraction continue; drafting stops and the session reports why.
