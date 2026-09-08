---
name: design-workflow
description: >
  Governs how the agent populates, reads, and maintains DESIGN.md.
  Load this skill when DESIGN.md is empty or incomplete and the
  person is ready to work on it, when a gallery option needs to
  reference Derived Identity or Observed Taste, or when a session
  produces new signals about the person's aesthetic that should be
  recorded. Do not load for routine implementation work where
  DESIGN.md is already populated and stable.
---

# Design Workflow — Populating and Maintaining DESIGN.md

## What DESIGN.md Is For

DESIGN.md makes the person's aesthetic identity legible to the
agent across sessions. Without it, every gallery option is drawn
from the conversation alone — accurate only to the current session,
with no memory of what the person has consistently responded to
over time.

A fully populated DESIGN.md has three sections:

- **References** — specific works, sites, designers, or artifacts
  the person has named or linked as influences, aspirations, or
  touchstones. These are chosen by the person, not inferred.
- **Derived Identity** — the agent's synthesis of what the
  References reveal about the person's aesthetic. This is a
  hypothesis, not a fact, and the person may correct it.
- **Observed Taste** — patterns the agent has noticed in this
  person's actual decisions across sessions. Not what they said
  they like — what they consistently chose, rejected, or returned
  to when given options.

These three sections serve different purposes and are populated
differently. Do not conflate them.

---

## When DESIGN.md Is Empty

An empty DESIGN.md is not a problem to solve immediately. It is
a gap to name honestly and begin filling only when the person
is ready.

**Name the gap first:**
"Your DESIGN.md doesn't have any references yet. The gallery
options I show you will be drawn from our conversation, which
means they'll reflect what you've said today — not a longer
pattern of what you're drawn to. If you'd like, I can ask a
few questions to start populating it. Or we can build first
and return to it later."

Wait for a response. Do not begin the population workflow
without explicit interest. Do not make "filling DESIGN.md" feel
like homework the person must complete before building.

---

## The Population Workflow

Run this workflow only when the person has indicated they want
to populate DESIGN.md. Do not run it speculatively, and do not
run it in auto/build mode.

Work through the three sections in order. Ask one question at
a time. Record the answer before moving to the next question.

### Section 1: References

The goal is to collect 3–7 specific, named references. Vague
genre references ("I like minimal design") are not useful here —
named works, sites, designers, or artifacts are.

**Opening question:**
"Can you name a website, app, book, poster, building, or any
other designed thing that feels like it's pointing in the
direction you want this site to go? It doesn't have to be
directly related to what we're building — anything that
captures the feeling."

After each answer:
- Confirm the reference by restating it back.
- Ask one follow-up: "What specifically draws you to that one?"
  Record the answer alongside the reference — not as a separate
  entry, but as a note on the reference itself.
- Then ask: "Is there another one, or does that feel like enough
  to start with?"

Continue until the person indicates they are done or until 7
references are collected. Do not push for more than 7 in a
single session. Quality and specificity matter more than quantity.

**Format for each Reference entry:**
- [Name or URL] — [person's own words about what draws them to it]


Never paraphrase the person's words in a Reference entry.
Use their exact language, even if it is informal.

---

### Section 2: Derived Identity

After References are collected, synthesize them into a
Derived Identity paragraph. This is the agent's work, not
the person's — but it must be presented as a hypothesis
and confirmed before being written.

**How to synthesize:**
Look across the References for recurring signals:
- Aesthetic registers (spare, dense, warm, severe, playful,
  institutional, handmade, technical)
- Structural preferences (hierarchy, flatness, rhythm, surprise)
- Relationship to convention (subverts it, refines it,
  ignores it, celebrates it)
- Tone (earnest, ironic, direct, lyrical, dry)

Identify the 2–3 most consistent signals. Ignore signals that
appear only once — a single outlier reference does not define
a pattern.

**Format:**
Write 3–5 sentences in plain language. No jargon. No design
buzzwords. The person should be able to read this and say
"yes, that's me" or "that's not quite right."

**Present it as a hypothesis:**
"Based on your references, here's what I think your aesthetic
direction is. Tell me if any of this is off:

[Derived Identity paragraph]

Does this feel accurate, or is something missing or wrong?"

Wait for a response. Apply corrections immediately. Re-present
once if corrections were substantial. Do not re-present more
than twice — if the second version still doesn't feel right,
note it as unresolved and return to it in a future session.

**Write to DESIGN.md only after confirmation.**

---

### Section 3: Observed Taste

Observed Taste is never populated during the initial population
workflow. It can only be written after the person has made
real decisions — chosen between options, rejected a direction,
or expressed a strong reaction to something in a session.

The first entry in Observed Taste should appear after the first
gallery the person responds to. The agent observes the reaction
and proposes an entry at the end of the session:

"I noticed you responded strongly to [option] and moved past
[option] quickly. Based on that, I'd add this to Observed Taste:
[proposed entry]. Does that feel like a stable preference worth
recording, or was it specific to this decision?"

Write to Observed Taste only on confirmation.

**Format for each Observed Taste entry:**
- [Pattern observed] — first seen [date], [context]


Entries in Observed Taste describe behavior, not stated
preferences. The distinction matters:
- WRONG: "Prefers minimal design" (stated preference)
- RIGHT: "Consistently chose the most typographically spare
  option when given three alternatives — 2026-04-10, URL
  structure gallery; 2026-04-15, homepage layout gallery"

---

## Reading DESIGN.md During a Session

Load DESIGN.md at session start whenever a gallery will be
presented or a significant design decision is approaching.

**If DESIGN.md is populated:**
- Read Derived Identity and Observed Taste before generating
  any gallery option.
- The implied gallery option must be traceable to a specific
  signal in one of these two sections. If it cannot be traced,
  it is not the implied option — it is a generic suggestion
  masquerading as one. Start over.
- If the person's stated direction in the current session
  conflicts with their Observed Taste, name the conflict once:
  "This direction is more [X] than what you've tended toward
  in previous sessions — you've usually [describe pattern].
  Is that a shift, or is this decision different for a reason?"
  Then proceed with the current session's stated direction.

**If DESIGN.md has References but no Derived Identity:**
- Derive it now, silently, before generating the gallery.
- Present it to the person after the gallery: "I also synthesized
  a Derived Identity from your references — want me to show you
  what I came up with before writing it to DESIGN.md?"

**If DESIGN.md is completely empty:**
- Name the gap as described above.
- Draw gallery options from the current session's conversation.
- Note which option would have been the implied option if
  DESIGN.md were populated: "The third option is drawn from
  what you said about [X] earlier — I'd normally trace this
  to your DESIGN.md references, but since we haven't built
  that yet, it's based on today's conversation only."

---

## Maintaining DESIGN.md Over Time

**Update References when:**
The person names a new influence, responds to a gallery with
"that's exactly the direction I want," or links something
with aesthetic intent. Ask before adding: "Should I add that
to your References in DESIGN.md?"

**Update Derived Identity when:**
Three or more new References have been added since the last
synthesis, or the person says the current Derived Identity
no longer feels accurate. Re-run the synthesis and re-present
as a hypothesis. Never update Derived Identity silently.

**Update Observed Taste when:**
A session produces a clear, repeatable pattern — the person
chose the same kind of option twice or more, rejected
the same kind of option twice or more, or expressed a strong
reaction they connected to a longer-standing preference.
Propose the entry at the end of the session, using the
MEMORY.md proposal moment: "I'd also add this to Observed
Taste in DESIGN.md — [entry]. Should I write it?"

**Never update DESIGN.md without confirmation in interactive mode.**
In auto/build mode, do not update DESIGN.md at all — log
a proposed update in DECISIONS.md and surface it at the
next interaction.

---

## DESIGN.md File Format

```markdown
# Design References and Identity

## References
<!-- Named by the person. Never inferred or added without confirmation. -->

- [Name or URL] — [person's own words]
- [Name or URL] — [person's own words]

## Derived Identity
<!-- Agent synthesis, confirmed by person before writing. -->

[3–5 sentences in plain language describing aesthetic direction.]

Last updated: [date]

## Observed Taste
<!-- Behavioral patterns, not stated preferences. Written after
observed decisions, proposed before writing. -->

- [Pattern] — first seen [date], [context]
- [Pattern] — first seen [date], [context]
```

---

## What This Skill Is Not

- It is not a design brief or requirements document.
- It is not a checklist the person must complete.
- It is not static — it is updated as the person's taste
  becomes clearer through actual decisions.
- Derived Identity is not the agent's aesthetic preference
  projected onto the person. It is a hypothesis derived
  entirely from the person's own stated references.

---

> DESIGN.md is how the agent remembers who this person is
> between sessions. The gallery is only as good as this file.