# START HERE — Adaptive Install (general)

> **Context: general.** conventional web-application practice; no domain-specific obligations.
> This folder is the *starter* variant: it installs into a repo that may
> already have its own agentic markdown, adapting what's there instead of
> replacing it. If your repo has no agentic markdown at all, this still works —
> it simply creates everything.

**Paste this file into your agent as the first prompt in a fresh session.** Do
not begin feature work in the same session. This is a documentation pass.

This folder ships only what cannot be reconstructed: the orchestrator
(`AGENTS.md`), the two process files (`LOOP-AGENTS.md`, `GRAPH-AGENTS.md`),
this prompt, the two `DOC-OVERHAUL-*.md` setup prompts, and the 5 skills in `.claude/skills/` and
`.agents/skills/`. Everything else is generated — the bodies are in the
Appendix at the end of this file.

---

## The three-file structure you are installing

| File | Role |
|---|---|
| `AGENTS.md` | **Orchestrator.** Read first, every session, by every tool. Precedence, routing, the Six Rules, Brainstorm Mode, Pre-Write Check, Mode, Core Constraints, skills, memory-file ownership, Post-Session Eval. |
| `LOOP-AGENTS.md` | **Single-service process.** Merge Protocol, the four-stage loop, the model roster, the Irreversible Decisions table, extension-file mapping. |
| `GRAPH-AGENTS.md` | **Multi-service process.** Node/edge manifest and coordinator role. Install only where more than one service is genuinely coordinated; each node still runs `LOOP-AGENTS.md` internally. |

`AGENTS.md` Section 0 routes between the two process files. Governance never
lives in a process file, and process never lives in the orchestrator — if you
find yourself wanting to put a rule in `LOOP-AGENTS.md`, it belongs in
`AGENTS.md` instead.

---

## The governing rule

**If a file exists, do not overwrite it. If it does not exist, create it.**

That is the install logic for anything with content worth keeping, and it has
one deliberate exception: tool entry points like `CLAUDE.md` are rewritten as
pointers — but only after Section 3 has rescued every rule they contained. Everything else in this prompt is about doing the *adaptation* well
— because a repo that already has agentic markdown usually has good reasons
for what it says, and those reasons are not always written down.

You are not migrating a repo onto a framework. You are making an existing
practice legible, and adding what it's missing.

---

## Section 1 — Read before writing anything

Read, in full, every one of these that exists. Do not skim, and do not write a
single file until this section is complete:

- `AGENTS.md`, `LOOP-AGENTS.md`, `GRAPH-AGENTS.md`, `CLAUDE.md`, `GEMINI.md`,
  `.github/copilot-instructions.md`, `.cursorrules`, `.windsurfrules`,
  `.aider.conf.yml`, `.gemini/settings.json`
- `MEMORY.md`, `DECISIONS.md`, `CONSTRAINTS.md`, `DESIGN.md`, and any archive
  companions (`docs/decisions-archive.md`, `docs/memory-archive.md`, etc.)
- Every `SKILL.md` under `.claude/skills/` and `.agents/skills/`
- `README.md`, `CONTRIBUTING.md`, and anything in `docs/` that reads like
  process rather than reference
- Any differently-named process network: `process.md`, `plan.md`, `tasks.md`,
  `task-template.md`, `BACKLOG.md`, `ALGORITHMS.md`, `SETUP.md`, benchmark or
  audit docs, coursework rubrics, team workflow docs

State what you found. For each file, one line: its original purpose, in its
own terms, not in this framework's vocabulary. This is Goal Extraction, and
skipping it is the most common way an install like this destroys something
that mattered.

---

## Section 2 — Classify the repo

Announce which Merge Protocol case applies, per `LOOP-AGENTS.md` Section 0:

| Case | Condition |
|---|---|
| A | No markdown at all |
| B | Markdown exists, none of it agent-governance related |
| C | A single existing `AGENTS.md` with its own, differently-authored rules |
| D | A rich, differently-named process network that predates this framework |
| E | File names already match this framework, at scale — mature files, archive splits, one-off extension files |

Also decide, and state, whether this repo is single-service or multi-service.
That determines whether `GRAPH-AGENTS.md` gets installed at all. If the answer
is genuinely unclear — a monorepo with independently deployed packages, say —
that ambiguity is a Rule 1 question. Ask it.

Cases D and E are Irreversible Decisions under Rule 3. Stop after this section
and get explicit confirmation before writing anything, and present your
reconciliation proposal in gallery format (three options plus a Reframe) as
Rule 2 requires.

---

## Section 3 — Distill the rules out of what's already there

Do this **before** creating or editing anything. Tool entry points accumulate
real rules — a `CLAUDE.md` with six months of hard-won corrections in it is not
boilerplate, and reducing it to a pointer without first rescuing its content
destroys exactly the reasoning this framework exists to preserve.

For every file found in Section 1 that contains agent instructions —
`CLAUDE.md`, `GEMINI.md`, `.github/copilot-instructions.md`, `.cursorrules`,
`.windsurfrules`, `.aider.conf.yml`, an existing `AGENTS.md`, and any process
doc carrying normative statements — build a **rule inventory**:

1. Extract every normative statement: anything phrased as must, never, always,
   don't, prefer, or a standing instruction in the imperative. Quote each one
   verbatim, with its source file and line.
2. For each, assign exactly one destination:

| The statement is… | Destination |
|---|---|
| A general behavioral rule (how the agent should act, in any repo) | `AGENTS.md` — as a Section 13 Project Specific Rule, or, if it genuinely restates one of the Six Rules, noted as already covered |
| A process mechanic (how work is scoped, reviewed, merged, deployed) | `LOOP-AGENTS.md` Section 1, or `GRAPH-AGENTS.md` for cross-node mechanics |
| Something that must never be done to this codebase | `LOOP-AGENTS.md` Section 3, the Irreversible Decisions table |
| A binding project constraint (a version pin, a platform limit, a policy) | `CONSTRAINTS.md` |
| An aesthetic or taste preference | `DESIGN.md`, under Declared Preferences |
| A past architectural choice with reasoning attached | `DECISIONS.md` |
| A durable lesson learned from a past failure | `MEMORY.md` |
| A genuine tool-specific quirk that cannot generalize | Stays in that tool's file — the one documented exception, see Section 4 |
| Redundant with something the new system already says | Dropped — but say which installed rule covers it |
| A normative statement inside an existing `SKILL.md` | Stays in that skill. Skills are not flattened into the rule inventory — see Section 5. |

3. Present the full inventory as a table and **stop for confirmation**. Every
   row shows: the quoted rule, its source, its destination, and — where you're
   proposing to drop it — which installed rule supersedes it.

This is an Irreversible Decision under Rule 3. Do not write a single file until
the inventory is approved.

**Nothing is deleted that has not been rehomed.** After the rewrite in
Section 5, verify that every rule in the inventory appears in exactly one
destination, and report any that don't. A rule that vanished between inventory
and verification is a bug, not a simplification.

---

## Section 4 — Create what's missing

For each row: if the file exists, do not overwrite it — it goes through
Section 5 instead. If it does not exist, create it.

| File | If missing |
|---|---|
| `AGENTS.md` | Copy this folder's `AGENTS.md` whole, pre-adapted for `general`. |
| `LOOP-AGENTS.md` | Copy this folder's `LOOP-AGENTS.md`. |
| `GRAPH-AGENTS.md` | Copy this folder's `GRAPH-AGENTS.md` **only** if Section 2 found this repo multi-service. Otherwise skip it and say you skipped it. |
| `CLAUDE.md` | Write from the Appendix. A pointer to `AGENTS.md`, no unique rules. |
| `GEMINI.md` | Write from the Appendix. A pointer to `AGENTS.md`, no unique rules. |
| `.github/copilot-instructions.md` | Write from the Appendix. |
| `.gemini/settings.json` | Write from the Appendix. **If it already exists, merge the context filenames into its array rather than replacing the file.** Drop the `GRAPH-AGENTS.md` entry if Section 2 found this repo single-service. |
| `MEMORY.md` `DECISIONS.md` `CONSTRAINTS.md` `DESIGN.md` | Write from the Appendix — headers only, then add whatever Section 3's inventory routed into them. Never invent entries beyond that. A fabricated `DESIGN.md` poisons every future gallery. |
| An `AGENTS.md` that already exists | **Never replace.** Append only the orchestrator block — everything from `<!-- ===== BEGIN CREATRWEB ORCHESTRATOR ===== -->` to the end of this folder's `AGENTS.md` — to the end of theirs. See Section 5. |
| Existing skills already in the repo | **Never delete.** Leave every file in place; Section 5 evaluates and registers them. |
| `.claude/skills/<name>/SKILL.md` and `.agents/skills/<name>/SKILL.md` | Write each skill folder individually. Never replace `.claude/skills/` or `.agents/skills/` as a directory — doing so can take the person's own skills with it. Copy the 5 skills from this folder, named in `AGENTS.md` Section 9. Both mirrors, byte-identical. Never author a skill from memory. |

This folder ships no `ADAPTATION.md` — the context's specializations are
already baked into `AGENTS.md` and `LOOP-AGENTS.md`, so there is nothing to
apply on top and nothing extra to copy across.

---

## Section 5 — Rewrite the entry points, fold in the rest

### Tool entry points become pointers

Once Section 3's inventory is approved and its rules are written to their new
homes, reduce each tool entry point to a pointer. This is the one place the
install deliberately rewrites an existing file, and it is allowed only because
the content was rescued first.

- `CLAUDE.md` → the Appendix body. A reference to `AGENTS.md` and nothing else.
- `GEMINI.md` → the Appendix body. Same.
- `.github/copilot-instructions.md` → the Appendix body, which points at the
  three-file structure and the memory files.
- `.cursorrules`, `.windsurfrules`, `.aider.conf.yml` and similar → reduce to a
  one-line instruction to read `AGENTS.md`, in whatever syntax that tool
  requires. Do not delete the file; a tool that finds nothing falls back to its
  own defaults, which is worse than a pointer.
- `.gemini/settings.json` → merge, never replace. Preserve every setting
  already there and add the context filenames.

**The tool-specific exception.** A rule may stay in a tool's own file only if it
is meaningless for the others — a Plan Mode behavior, an autocomplete quirk, a
setting only that tool reads. If a rule would matter for any other agent, it
belongs in `AGENTS.md`. When you keep one, say why in a comment in that file,
so the next person knows it was a decision rather than an oversight.

### Existing skills are evaluated and registered, never removed

A skill already in the repo encodes a decision about how this codebase should
be worked on. Treat every `SKILL.md` found in Section 1 as content to preserve.

For each one:

1. **Keep the file.** No existing skill is deleted, moved out of the way, or
   overwritten by a shipped skill of the same name.
2. **Register it** in `AGENTS.md` Section 9's table with an explicit load
   trigger — the condition under which an agent should read it. If the skill
   has no stated trigger, propose one from its content and confirm it.
3. **Adapt it minimally.** Add front matter if it has none, add the trigger,
   and cross-reference any rule it depends on. Do not rewrite its substance,
   its voice, or its examples without confirmation.
4. **Mirror it.** If it exists in only one of `.claude/skills/` or
   `.agents/skills/`, copy it to the other so both stay byte-identical. Say
   that you did.
5. **Name collisions are the person's call.** If an existing skill shares a
   name with one shipped here, do not merge them and do not assume the shipped
   version wins. Show both, say where they differ, and ask which survives — or
   whether the existing one should be renamed and both kept.

An existing skill that contradicts an installed rule is a conflict to surface,
not to resolve. Report it and let the person decide.

### Everything else is adapted, not rewritten

For every other existing file from Section 1, choose exactly one outcome and
say which, with one sentence of reasoning:

1. **Keep as-is and cross-link.** The file works. Add a one-line reference to
   it in `LOOP-AGENTS.md` Section 4's mapping table so future sessions know it
   exists and what it's for.
2. **Annotate without rewriting.** The file works but its relationship to the
   loop is unstated. Add a short header noting how it maps — which loop stage
   it serves, or which rule it supports. Do not touch its body.
3. **Extend.** The file covers part of what the installed files cover, and
   agrees with them. Append the missing pieces, clearly marked, preserving the
   existing voice and numbering.
4. **Fold in and deprecate.** Only for a small file clearly superseded, never
   for a large or actively-used one, and never without confirmation.

**An existing `AGENTS.md`** that is empty or contains only a placeholder
heading is treated as absent — copy this folder's file in whole. Anything with
real content is Case C, and is handled by appending, never replacing:

1. Its rules go through Section 3's inventory first, so nothing in it is lost.
2. Copy everything from this folder's `AGENTS.md` starting at the
   `<!-- ===== BEGIN CREATRWEB ORCHESTRATOR ===== -->` marker, and paste it at
   the **end** of the repo's existing `AGENTS.md`. Leave everything already
   there untouched, above the pasted block.
3. The block declares its own precedence — the repo's existing rules win — and
   scopes its own section numbering, so the file's existing numbers keep
   working. Do not renumber anything.
4. Report every conflict between the two halves. Do not resolve one silently,
   and do not delete a rule from either half.
If it mixes governance and process — most hand-written ones do — propose the
split into `AGENTS.md` and `LOOP-AGENTS.md` as a gallery and get confirmation
before performing it.

When the existing rules and this framework's rules disagree, the existing rules
win by default — they encode decisions someone actually made about this
codebase. Say what the conflict is and let the person choose.

---

## Section 6 — What must survive

An install that produces a tidy file tree and loses the reasoning behind it has
failed. Before you report, verify each of these:

- **Loop engineering is present.** Every unit of work maps to one issue with a
  single testable outcome, running scope → implementation → QA self-review →
  production-readiness gate. If the repo already has its own loop description
  (`process.md`, a `BACKLOG.md`, a PR template), `LOOP-AGENTS.md` Section 1
  cross-references it rather than duplicating it.
- **Graph engineering is available but not imposed.** `GRAPH-AGENTS.md` exists
  only where more than one service is actually coordinated, and where it does,
  each node still runs its own loop.
- **The orchestrator/process split holds.** No rule ended up in a process file;
  no process mechanics ended up in `AGENTS.md`.
- **Human taste has somewhere to live.** `DESIGN.md` exists and is empty rather
  than filled with your guesses. An empty `DESIGN.md` is a correct state.
- **Critical thinking is structurally required, not encouraged.** Rule 1 (one
  question first), Rule 2 (options before committing), and Rule 3 (stop at
  irreversible decisions) are in the installed `AGENTS.md` and are not softened
  by anything you added during reconciliation.
- **Every inventoried rule was rehomed.** Cross-check Section 3's inventory
  against the installed files. Any rule that appears in no destination is a
  regression — restore it before reporting.
- **No existing skill was deleted or overwritten.** Every `SKILL.md` present
  before the install is still present, registered in `AGENTS.md` Section 9 with
  a load trigger, and mirrored across both skill directories.
- **No entry point still carries rules.** `CLAUDE.md`, `GEMINI.md` and the
  other tool files are pointers, except for documented tool-specific quirks.
- **Nothing points outside this repo.** No installed file references the
  Creatrweb repo, a context folder, or any path you cannot resolve from the
  repo root.

---

## Section 7 — Populate the Model Routing Plan

Ask which tools and models are actually available for: issue scoping,
mechanical implementation, complex-logic implementation, QA self-review, and
the production-readiness gate. Write the answers into `LOOP-AGENTS.md`
Section 2 at whatever granularity the person gives — service name or specific
model ID — and do not invent a model they did not name. If a role is left
blank, keep the template's example and mark it unconfirmed.

The readiness gate never gets a cheap-tier model. If the roster doesn't include
a frontier-tier option for it, say so plainly rather than quietly downgrading.

---

## Section 8 — Report and stop

Produce:

1. The Goal Extraction list from Section 1.
2. The Merge Protocol case and the single/multi-service determination, with
   evidence for both.
3. The rule inventory from Section 3, showing each rule's final destination
   and confirming none was lost.
4. Files created, files rewritten to pointers, files left untouched, files
   adapted — and for each adapted file, which of the four outcomes and why.
5. Any tool-specific rule you kept in place, and why it can't generalize.
5b. Every pre-existing skill, its assigned load trigger, what you changed in
   it, and any name collision awaiting the person's decision.
6. Every conflict you found between existing rules and this framework's rules,
   unresolved, for the person to decide.
7. The Section 6 checklist, each item confirmed or flagged.

Then stop. Do not begin feature implementation in this session.

---

# Appendix — Bodies for files this folder does not ship

This folder deliberately contains only the governance and process files plus
the skills. Everything below is what you write when Section 3 says a file is
missing. Write each verbatim. Do not improvise a replacement.

## `CLAUDE.md`

````markdown
# CLAUDE.md

@AGENTS.md

<!-- Context: general.
     Pointer only. AGENTS.md is the authoritative rule set for every tool.
     Do not add tool-specific rules here — a rule that matters for Claude
     Code almost always matters for the others, and belongs in AGENTS.md. -->
````

## `GEMINI.md`

````markdown
# GEMINI.md

See AGENTS.md for all project context, conventions, and task ownership.

<!-- Context: general.
     Pointer only. AGENTS.md is the authoritative rule set for every tool.
     Do not add tool-specific rules here — a rule that matters for Gemini
     CLI almost always matters for the others, and belongs in AGENTS.md. -->
````

## `.github/copilot-instructions.md`

````markdown
# GitHub Copilot Instructions

This project uses AGENTS.md as its standing instruction set (Creatrweb `general` context).
Read AGENTS.md at the project root before responding to any request. AGENTS.md
is the orchestrator: it holds the rules and routes the mechanics to
LOOP-AGENTS.md (single-service work) or GRAPH-AGENTS.md (multi-service work).
Read whichever process file AGENTS.md Section 0 routes you to.

## Instruction Priority

When instructions conflict, resolve in this order:

1. Explicit statement from the person during the session
2. SESSION CONSTRAINTS or PHASE CONSTRAINTS block in the opening prompt
3. AGENTS.md Six Rules
4. LOOP-AGENTS.md / GRAPH-AGENTS.md process rules
5. Loaded skill content
6. These Copilot instructions

## Project Memory Files

Read these files at session start, in this order:

| File | Purpose |
|---|---|
| `AGENTS.md` | Orchestrator — standing rules, routing, skills, memory ownership |
| `LOOP-AGENTS.md` | Single-service process — Merge Protocol, the loop, model roster, Irreversible Decisions |
| `GRAPH-AGENTS.md` | Multi-service process — node/edge manifest, coordinator role (only if present) |
| `MEMORY.md` | Durable confirmed lessons from past sessions |
| `DECISIONS.md` | Architectural choices and unresolved checkpoints |
| `CONSTRAINTS.md` | Active project constraints — all are binding |
| `DESIGN.md` | Person's aesthetic references and derived identity |

If any of these files does not exist yet, note the absence and
proceed. Do not create them speculatively — DECISIONS.md and
CONSTRAINTS.md are created on first need, MEMORY.md on first
confirmed lesson, DESIGN.md on first design reference.

## Skills

Skills are located in `.agents/skills/`. Each skill is a
directory containing a `SKILL.md` file. Load a skill by reading
its `SKILL.md` when AGENTS.md or the person references it by name.

| Skill | Load when |
|---|---|
| `gallery-format` | Rule 2 fires — options needed before any design or architecture decision |
| `socratic-depth` | Rule 1 fires — a question must be asked before a significant change |
| `indieweb-specs` | Implementing or modifying rel=me, microformats2, Webmention, IndieAuth, Micropub, WebSub |
| `indieweb-principles` | A decision touches ownership, portability, or longevity |
| `posse-syndication` | Finalizing URL structure, syndication targets, or export endpoints |
| `design-workflow` | DESIGN.md is empty, or a gallery needs Derived Identity or Observed Taste |
| `security` | Writing any Webmention, IndieAuth, Micropub, or media upload handler |
| `testing` | Before releasing any spec route or merging any branch |
| `memory-files` | End of session; proposing MEMORY.md or DECISIONS.md updates |

> Token budget note: load only when that skill's work is the focus
> of the current exchange. Never pre-load.

## Non-Negotiable Behaviors

These apply in every mode, regardless of how the request is phrased:

- Ask one question before any significant change. A significant
  change introduces visible behavior, adds a route, modifies a
  schema, creates a file others depend on, or touches the
  Irreversible Decisions table.
- Show 2–3 meaningfully different options before committing to
  any design or architectural direction.
- Default to single-turn responses. Use multi-step agentic
  approaches only when the task requires reading more than two
  files, or when a prior step's output must inform the next
  step's approach. Log every agentic loop in DECISIONS.md.
- Never break a public URL. Permanent redirects for moved content.
  No database IDs in public URLs.
- Keep `GET /export.json`, `GET /feed.xml`, and `GET /feed.json`
  functional at all times.
- Never edit AGENTS.md without explicit human instruction.
- Never auto-syndicate content. Syndication is always
  human-initiated.
- Before writing any file, silently check:
  1. Does this file appear in the Irreversible Decisions table?
  2. Does this file render content a microformats parser will read?
     If yes, it must be a Server Component — no `use client`.
  3. Does this change install a package or call an external service?
     If yes, `docs/dependencies.md` must be updated this session.

## Copilot-Specific Notes

- In **chat mode**: apply full question and gallery protocols.
  Ask before building. Wait for answers.
- In **inline suggestion mode**: mechanical changes only.
  Do not make architectural decisions via inline suggestion.
  Surface significant choices as a chat comment instead.
- If a Copilot Workspace plan is being generated: present the
  plan as a gallery of approaches before implementing.
  Do not begin implementation until the person approves a direction.
````

## `.gemini/settings.json`

````json
{
  "context": {
    "fileName": [
      "AGENTS.md",
      "LOOP-AGENTS.md",
      "GRAPH-AGENTS.md",
      "DECISIONS.md",
      "CONSTRAINTS.md",
      "DESIGN.md",
      "MEMORY.md"
    ],
    "fileFiltering": {
      "respectGitIgnore": true
    }
  }
}
````

## `MEMORY.md`

````markdown
<!-- Context: general. Generated from the Creatrweb `general` payload. -->
<!-- Agent reads this file at every session start. Surface any entry marked PENDING CONFIRMATION
to the human before proceeding. Do not act on a pending entry — wait for explicit confirmation
or rejection. -->
````

## `DECISIONS.md`

````markdown
<!-- Context: general. Generated from the Creatrweb `general` payload. -->
# Decisions
<!-- IMPORTANT: Load CONSTRAINTS.md and DESIGN.md alongside this
file at every session start. Constraints listed in CONSTRAINTS.md are binding regardless of what is recorded here. Design identity in DESIGN.md informs all gallery
options regardless of session context. -->

## Project Profile

<!-- Operational details for this project. Kept here, not in AGENTS.md,
     to keep the root instruction file framework-agnostic and safe to
     publish. Do not put credentials, hostnames, file paths, or API
     keys here — those belong in .env.

     An agent fills this section during Phase 1 by asking the person
     plain-language questions. If this section is empty, ask before
     writing any code. See AGENTS.md → Detect the Framework. -->

- **Stack:** <!-- e.g. Next.js 15 + TypeScript, FastAPI + Python 3.12 -->
- **Deployment:** <!-- type only — e.g. "Node.js PaaS, single process,
  npm start". No hostnames or server details. -->
- **Database:** <!-- type and ORM only — e.g. "SQLite via Drizzle ORM".
  No file paths. -->
- **Version pins:** <!-- key constraints — e.g. "Node 20, Next.js 15.x".
  None if using stable defaults. -->
- **Framework AGENTS.md:** <!-- e.g. "nextjs/AGENTS.md does not yet
  exist — sessions follow root AGENTS.md only" -->
- **Profile switch rule:** Stop before touching existing files. Record
  current state and reason here. Confirm new profile explicitly. Flag
  every file needing migration before starting.

---

## REVIEW REQUIRED — Read before starting next session
<!-- Agent writes this block. Human must confirm or override each item before new code is written. -->
- [ ] [DATE] [TOOL] Conservative default applied: [what was chosen and why]
- [ ] [DATE] Gallery deferred: [what decision was skipped and what options were considered]

---

## Example Phase 1 — [Tool Name]

<!-- Created by the agent at session start.
     Record every significant decision made during this phase.
     Use bullet points. One fact per bullet.
     Flag gaps or deferred items as noted below. -->

### Stack Confirmed
<!-- e.g. which framework, runtime, package manager, config approach -->

### Schema and Data Decisions
<!-- e.g. ID strategy, timestamp format, default values, unique columns -->

### Files Created
<!-- List every file created and its purpose -->

### Vendor Dependencies Added
<!-- For each: name, purpose, sends data off-domain (yes/no),
     self-hosting alternative, documented in docs/dependencies.md -->

### Environment Variables Required
<!-- List names only — no values. e.g.:
     - DATABASE_URL
     - API_KEY_NAME -->

### Gaps and Deferred Items
<!-- Any Phase 1 deliverable not completed, logged for the next phase -->

### Unresolved Checkpoints Entering Phase 2
- [ ] <!-- item -->

---

## Example Phase 2 — [Tool Name]

<!-- Same structure as Phase 1. Add a "Corrections Applied" subsection
     if prior-phase errors were fixed in this session. -->

### Phase N Gap Discovered
<!-- If a prior-phase deliverable was missing, record it here with a
     note that it is a prior-phase gap, not a Phase 2 decision. -->

### Components Built
<!-- List each component/route/feature with its file path and purpose -->

### Corrections Applied
<!-- What was wrong, what was fixed, what file changed -->

### Vendor Dependencies Added
<!-- Same format as Phase 1 -->

### Environment Variables Required
<!-- Cumulative list — include all variables from prior phases plus new -->

### Unresolved Checkpoints Entering Phase 3
- [ ] <!-- item -->

---

<!-- Add a new dated section at the start of each phase following
     the same pattern. Resolved checkpoints from the prior phase
     should be marked [x] and left in place — do not delete them.
     They are the audit trail. If empty, begin with Phase 1. -->
````

## `CONSTRAINTS.md`

````markdown
<!-- Context: general. Generated from the Creatrweb `general` payload. -->
# Constraints

<!-- One entry per constraint. Format:
     CONSTRAINT: [plain-language description]
     SCOPE: [what it applies to]
     SET: [date or "this session"]

     Constraints are permanent until explicitly lifted.
     See AGENTS.md → User Constraints for full rules. -->


<!-- An empty file is still valid and still required.
     Absence of entries means no constraints have been stated yet —
     not that this file is optional. The agent must create this
     file at project root the first time any constraint is stated,
     even if AGENTS.md is read-only. -->
````

## `DESIGN.md`

````markdown
<!-- Context: general. Generated from the Creatrweb `general` payload. -->
# DESIGN.md — Creative Identity Document

<!-- GOVERNANCE
     This file is owned by the human. Sections marked HUMAN-AUTHORED
     are filled in by you, ideally before the first build session, or
     collaboratively with an AI assistant in a dedicated conversation.
     Sections marked AGENT-PROPOSED are populated by the agent during
     sessions and confirmed by you — the same pattern as MEMORY.md.

     The agent reads this file at every session start.
     The agent never asks design questions out of sequence:
       1. References must exist before Derived Identity is attempted.
       2. Derived Identity must exist before Declared Preferences are prompted.
       3. Observed Taste is queued during sessions and proposed at session end.

     If this file is empty or incomplete, the agent asks for References
     before any other design question. It never asks for Declared
     Preferences first.

     Taste constraints recorded here are distinct from technical
     constraints in CONSTRAINTS.md. Do not move entries between files
     unless a taste preference becomes a technical requirement. -->

---

## References
<!-- HUMAN-AUTHORED
     The most important section. Fill this before anything else.
     The agent derives everything downstream from what you put here.
     Screenshots and art files should be committed to your repository.
     URLs are acceptable if files are not available. -->

- **Admired applications or websites:**
  <!-- Filenames of screenshots in your repo, or URLs.
       Example: screenshots/notion-dark.png, https://example.com -->

- **Admired art, design work, or visual culture:**
  <!-- Filenames, URLs, or plain descriptions.
       Example: Saul Bass film posters, brutalist typography,
       screenshots/bauhaus-ref.jpg -->

- **Admired writing or editorial voices:**
  <!-- Publications, authors, or specific pieces whose tone or
       structure you want to echo. These inform copy direction
       as much as visual references do. -->

- **Logo:**
  <!-- Filename if available in your repository.
       Example: assets/logo.svg
       Leave blank if none exists yet. -->

- **Existing brand materials:**
  <!-- Any other files — type specimens, color swatches, style guides —
       already committed to the repo. -->

---

## Derived Identity
<!-- AGENT-PROPOSED, HUMAN-CONFIRMED
     The agent fills this section collaboratively after References exist,
     by asking questions and proposing observations. You confirm, correct,
     or expand each entry before it is considered stable.
     Do not fill this section yourself before discussing it with the agent —
     the value is in the derivation process, not the output alone. -->

- **What your references share:**
  <!-- The common thread the agent observes across your inputs.
       Example: "High contrast, sparse layout, type as the primary
       visual element, no decorative illustration." -->

- **The tension you are navigating:**
  <!-- The productive contradiction in your references — the thing
       that makes your aesthetic specific rather than generic.
       Example: "Warm and personal, but not precious or nostalgic." -->

- **What you dislike in contrast:**
  <!-- Defined negatively. Taste is largely shaped by refusal.
       Be specific — "corporate" is a start, but "the visual language
       of SaaS landing pages: gradient CTAs, stock photography of
       smiling teams, artificial whitespace" is more useful.
       This section informs the agent's gallery options as strongly
       as positive preferences do. -->

- **The feeling on first load:**
  <!-- One to three words or a short sentence describing the immediate
       emotional register you want a first-time visitor to experience.
       Example: "Curious. Like finding someone's personal library." -->

---

## Declared Preferences
<!-- HUMAN-AUTHORED, after Derived Identity is complete.
     These are starting points, not permanent constraints.
     If you change your mind, update this section and note the
     change in DECISIONS.md. Do not move taste preferences to
     CONSTRAINTS.md unless they become technical requirements. -->

- **Color direction:**
  <!-- A palette, a mood, specific hex values, or a reference.
       Example: "Dark background. Warm off-white text. One accent
       color, used sparingly — leaning toward ochre or rust." -->

- **Type direction:**
  <!-- Specific typefaces, or a descriptive direction if typefaces
       are not yet chosen.
       Example: "Serif for body, monospace for metadata and code.
       Nothing geometric or neutral — something with visible history." -->

- **Layout disposition:**
  <!-- How you want space and content to relate.
       Example: "Generous margins. Text width constrained. No sidebars.
       Let the content breathe." -->

- **Motion and interaction:**
  <!-- Your position on animation, transitions, and interactive behavior.
       Example: "No decorative animation. Transitions only where they
       carry meaning. Fast." -->

- **What must never appear:**
  <!-- Visual or tonal elements that would immediately feel wrong.
       These are taste refusals, not technical constraints.
       Example: "Stock photography. Gradient hero sections.
       Auto-playing anything. Emoji used decoratively." -->

---

## Observed Taste
<!-- AGENT-PROPOSED, HUMAN-CONFIRMED
     Populated during sessions when the agent notices a signal —
     an enthusiasm, a complaint, a reference made in passing,
     an implied direction not yet consciously claimed.
     Proposed at session end alongside MEMORY.md updates.
     Format mirrors MEMORY.md:

     YYYY-MM-DD · CATEGORY · Observation in one sentence.
         [Optional: the exact exchange or context that surfaced it]

     Valid categories:
     INFLUENCE · REFUSAL · TENSION · VOICE · DIRECTION

     Examples:
     2026-04-10 · REFUSAL · Finds AI-generated imagery dishonest
         rather than merely aesthetically displeasing.
         [User: "it's not that I dislike how it looks, I dislike
         what it means"]
     2026-04-10 · TENSION · Wants the site to feel personal but
         is resistant to anything that reads as self-indulgent.
     2026-04-10 · INFLUENCE · Referenced Saul Bass twice without
         being asked about visual influences.

     Keep under 50 entries. When approaching the limit, ask the
     user to review — consolidate stable patterns into Derived
     Identity and archive older entries to docs/design-archive.md. -->

---

<!-- The agent holds the brush. You choose what gets painted.
     This document is how you tell the agent what you see. -->
````
