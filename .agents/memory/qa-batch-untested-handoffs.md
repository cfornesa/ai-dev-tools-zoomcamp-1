---
name: qa-batch-untested-handoffs
description: A stage-2 engineering handoff citing "N tests passed" can mean pre-existing regression tests, not new coverage of the issue's own acceptance criteria; QA must diff the actual test file against the criteria list, not trust the count.
metadata:
  type: feedback
---

Across the 2026-09-16 QA batch (#571-#587, see `docs/tasks.md`'s
"QA batch reconciliation" entry), the majority of stage-2 handoffs reported a
plausible-sounding passing test count ("backend focused profile/admin suite
23 passed", "PublicGallery tests 22 passed; new backend public-search test
passed") that turned out, on inspection, to be **existing** suites passing as
regression evidence, with as few as zero or one genuinely new test actually
exercising the issue's own acceptance criteria. Concrete pattern found
repeatedly: a new validated field/endpoint/component ships with real,
correct implementation, but the test suite cited in the handoff never
touches the new code path at all — `seo_config` validation across three
different issues (#579/#580), `q`/`account` search filters (#581/#582), and
a shared theme validator (`scenes/theme.py`, #576) all shipped with zero
direct tests despite passing handoffs.

**Why:** "N tests passed" is true and reassuring but answers the wrong
question — it doesn't establish that N includes tests of the thing that
changed. Self-review (or any review) that stops at re-running the cited
command inherits this gap silently.

**How to apply:** when QA-ing a diff, open the actual test file(s) the
handoff cites and check each acceptance-criteria bullet against a specific
test, by name, not just a passing count. If a bullet has no matching test,
add one before verdicting `PASS` — don't accept "the code looks right" as a
substitute for a verified assertion, even for code you'd otherwise trust.
This is now this repo's default expectation for every stage-4 QA pass, not
a one-off finding.
