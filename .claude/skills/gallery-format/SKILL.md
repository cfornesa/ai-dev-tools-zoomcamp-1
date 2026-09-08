---
name: gallery-format
description: >
  Formats and governs the presentation of design and architectural
  options before any significant build decision. Load this skill
  whenever Rule 2 applies — before committing to any design choice,
  architectural direction, or feature approach. Also load when Rule 6
  applies and alternatives to non-functional technology must be shown.
---

# Gallery Format — Show Options Before Building

## Purpose

The gallery is not an approval mechanism. It is a reflection instrument.
Viewing meaningfully different alternatives improves decision quality
even when none of the presented options are chosen. The goal is to make
the person's actual preference legible — to themselves — before anything
is built.

## Structure

Every gallery contains three option entries plus one Reframe entry.
No more, no fewer, unless the person explicitly requests otherwise.

### Option Entry Format
[Label — one word, not "Option A"]
- Approach: Two sentences describing what this is and how it feels.
- Trade-off: One sentence — what this gives, and what it costs.
- Example: A concrete illustration — URL pattern, schema snippet,
UI sketch, or code fragment. Never omit this.

### Reframe Entry Format
[Reframe]
- One sentence restating the underlying problem differently.
- Challenge: What this reframing reveals about the original request.
- Closing question: "Does this change what you want to build?"


---

## Rules for All Four Entries

**The three option entries:**
- Must be meaningfully divergent — different in approach, not just
  in implementation detail. If all options feel similar, they are
  not divergent enough. Start over.
- Must include at least one option you would not recommend. Do not
  signal which one this is.
- Do not signal a preference. Use identical formatting and length
  for all entries. Let the person's reaction drive the choice.
- The implied option — the one that surfaces a direction not yet
  consciously articulated — must be traceable to specific signals
  from this user's conversation, DESIGN.md References, Derived
  Identity, or Observed Taste. If DESIGN.md is empty or absent,
  name that gap before presenting the gallery:
  "I don't have your design references yet, so the implied option
  below is drawn from the conversation rather than your DESIGN.md.
  It may be less accurate than usual."

**The Reframe entry:**
- Does not propose an implementation. It reframes the problem.
- Must challenge the premise of the request — not just offer a
  different solution to the same problem.
- Always ends with a closing question. Never omit it.
- If the person dismisses the Reframe without engaging with it,
  note it once: "The reframe is still open if you want to return
  to it." Do not push further.

**In auto/build mode:**
- Select the conservative default from the three options.
- Log all three options and the Reframe in DECISIONS.md with the
  default selected noted.
- Do not present the gallery to the user — they are not available
  to respond. Surface the full gallery at the next interaction.

---

## When to Load This Skill

Load on any of the following triggers:
- Rule 2 applies — a significant design or architectural choice
  is about to be made.
- Rule 6 applies — a specified technology is non-functional and
  alternatives must be shown.
- The person asks to see options, compare approaches, or is
  uncertain between directions.
- Brainstorm Mode is exiting and a direction is being confirmed
  for the first time.

Do not load for mechanical changes. Do not load for decisions
already made and logged in DECISIONS.md unless the person
explicitly requests reconsideration.

---

## Example Gallery

**Context:** Person is deciding on URL structure for a personal blog.

---

**Dated**
- Posts live at `/YYYY/MM/DD/slug`, making time of writing part of
  the permanent address. Feels archival, like a newspaper morgue.
- Trade-off: Gives immediate temporal context and is the most
  durable IndieWeb convention; costs flexibility if you want to
  de-emphasize when something was written.
- Example: `/2026/04/10/why-i-left-twitter`

**Topical**
- Posts live at `/writing/slug`, grouping by content type rather
  than time. Feels more like a book than a diary.
- Trade-off: Cleaner for evergreen content; loses the temporal
  signal that makes a personal site feel lived-in over time.
- Example: `/writing/why-i-left-twitter`

**Flat**
- Posts live at `/slug` with no subdirectory. Maximum brevity,
  minimal hierarchy.
- Trade-off: Simplest to type and share; provides no structural
  signal about content type or time, which complicates future
  reorganization.
- Example: `/why-i-left-twitter`

**Reframe**
- The URL structure question assumes the site's primary identity
  is as a publishing archive. But what if the primary identity
  is as a presence — a place that says who you are right now,
  with the archive as a secondary layer?
- Challenge: If the front door is the person, not the posts, the
  URL structure matters less than what lives at `/` and how posts
  are linked from there.
- Does this change what you want to build?

---

> The gallery is how the person discovers what they actually want.
> Your job is to make the options real enough to react to.