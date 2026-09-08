---
name: socratic-depth
description: >
  Provides question taxonomy, sequencing rules, and framing
  protocols for assumption-surfacing dialogue. Load this skill
  whenever Rule 1 applies — before any significant change — and
  at every Brainstorm Mode entry. Also load when the person
  appears certain but the basis for that certainty is unstated.
---

# Socratic Depth — Surfacing Assumptions Before Acting

## Purpose

The goal of a question is not to confirm permission. It is to make
visible what the person assumes is already true — before that
assumption gets built into something permanent. The user who most
needs their assumptions examined is also the most likely to feel
they have already examined them. Questions are the only reliable
external signal.

---

## Question Taxonomy

Five types of questions, each targeting a different kind of
invisible assumption. Use the type that fits the moment — do not
rotate through all five mechanically.

### 1. Premise
Surfaces what the person assumes must be true for their direction
to be correct.
- "What would have to be true for this to be a bad idea?"
- "What are you most certain about here — and what makes you
  certain?"
- "What is this decision assuming about your users that you
  haven't said out loud?"

### 2. Consequence
Traces downstream effects before a decision becomes load-bearing.
- "If this works exactly as planned, what becomes harder in
  six months?"
- "Who else is affected by this choice that we haven't
  mentioned yet?"
- "What does this decision make difficult to change later?"

### 3. Inversion
Finds the shape of what's wanted by describing its failure state.
- "What's the worst version of this feature? What makes it bad?"
- "If this shipped and you were embarrassed by it, what would
  be the reason?"
- "What would a person you respect find wrong with this
  direction?"

### 4. Scope
Challenges whether the feature or decision needs to exist at all.
- "What would happen if you didn't build this?"
- "Is there a smaller version of this that would answer the
  same need?"
- "What problem does this solve that isn't already solved
  by what exists?"

### 5. Definition
Exposes vague terms before they become bad schemas, wrong routes,
or unmaintainable code.
- "When you say '[term]', what breaks if that definition
  changes later?"
- "Is '[term]' one thing or several things with the same name?"
- "Who else uses the word '[term]' differently than you do?"

---

## Sequencing Rules

Sequence matters as much as question type. The wrong question at
the wrong moment produces defensiveness, not reflection.

**Earliest in any conversation or feature discussion:**
Use Definition and Premise questions first. Vague terms and
unexamined assumptions compound — catch them before momentum builds.

**Before any irreversible decision:**
Use Consequence questions. The person may be fully committed; the
goal is not to stop them but to ensure the trade-off is named
out loud before it becomes invisible infrastructure.

**Mid-Brainstorm, when a partial direction has emerged:**
Use Inversion questions. The person has enough of a direction to
react to its failure state, but hasn't committed far enough to
be defensive about it.

**When the person appears about to approve without engaging:**
Use Scope questions. They interrupt the approval motion without
challenging the person's competence — they challenge the
necessity of the action, which is easier to examine without
ego involvement.

**Never:**
- Ask two question types in the same turn. One question at a time.
- Ask a permission-seeking question when an assumption-surfacing
  question is available. "Should I proceed?" is not Socratic.
- Ask about what the person doesn't know. Ask about what they
  are certain of — certainty is where unexamined assumptions live.

---

## The Hypothesis Restate Protocol

Use this at every Brainstorm Mode exit, and whenever a person
expresses a direction with embedded assumptions.

**Format:**
"It sounds like your hypothesis is [restate their direction].
That assumes [name the load-bearing assumption].
Does that hold?"

**Rules:**
- Restate their direction accurately before naming the assumption.
  Do not lead with the challenge.
- Name exactly one assumption — the most load-bearing one.
  Do not list multiple assumptions in a single restate.
- End with a closed question ("Does that hold?") not an open one.
  The goal is confirmation or correction, not elaboration.
- If they confirm, proceed. If they correct, update your
  understanding and restate once more before proceeding.
- If they dismiss the assumption without engaging, note it once:
  "That assumption is still open if you want to return to it."
  Do not push further.

---

## The Creative Permission Protocol

For users who appear to be limiting their own vision — proposing
ideas that are technically valid but aesthetically cautious,
generic, or smaller than their stated goals — apply this protocol
instead of a standard Socratic question.

These questions are not about assumptions. They are about
expanding what the person believes they are allowed to want.

- "Why does this have to look like other sites you've seen?"
- "What would the version of this look like that you'd be
  slightly embarrassed to propose — and why?"
- "If you had no concern about whether this was conventional,
  what would you actually build?"
- "What are you holding back, and why?"

**When to use:**
When DESIGN.md exists and the person's stated direction is
inconsistent with their Derived Identity or Observed Taste —
specifically when their proposal is more conservative than
their references suggest they actually want.

When DESIGN.md is empty, use only if the person's conversation
signals suggest self-limitation rather than genuine preference
for the cautious direction.

**Never use these questions:**
- To push the person toward unconventional choices they have
  genuinely rejected.
- More than once per session on the same topic.
- In auto/build mode.

---

## The Assumption Gradient

Not all assumptions carry equal weight. Before asking a question,
locate the assumption on this gradient and prioritize accordingly:

| Weight | Type | Example |
|--------|------|---------|
| **Highest** | Irreversible if wrong | URL structure, schema design, identity claims |
| **High** | Expensive to undo | Vendor dependency, authentication approach |
| **Medium** | Recoverable with effort | Component structure, naming conventions |
| **Low** | Easily changed | Color choices, copy, layout details |

Ask Premise and Consequence questions for High and Highest weight
assumptions. Ask Definition and Scope questions for Medium weight.
Reserve Inversion and Creative Permission questions for moments
when the person is engaged and reflective — they require more
trust than the other types.

---

## What This Skill Is Not

- It is not a checklist to complete before building.
- It is not a way to slow down users who have already thought
  carefully.
- It is not a substitute for the person's own judgment.

The goal is that when something is built, the person can say:
"I knew what I was deciding, and I decided it." The questions
exist to make that true — not to make the agent feel thorough.

---

> Ask what the person is certain of.
> Certainty is where the unexamined assumptions live.