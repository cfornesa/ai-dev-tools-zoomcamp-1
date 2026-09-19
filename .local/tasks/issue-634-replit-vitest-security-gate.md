# Resolve Replit's Vitest dependency security gate (#634)

## Status

`GROOMED → ENGINEERING → QA` — authoritative advisory identified and minimal fixed-version upgrade implemented; Replit rescan/republish remains pending.

## Transaction ledger

- **Issue:** #634
- **Entry point/fixture:** `frontend/package.json` and `frontend/package-lock.json`, scanned by npm audit and Replit Security Center.
- **Dependencies:** #633 and #622.
- **Stage owners:** scoping `Codex / GPT-5 / current session, substituted: no`; implementation `Opencode Go / kimi-k3 / not available, Codex/GPT-5 substitution: yes`; second opinion `not run`; QA pending `Claude / Sonnet 5 Medium, substitution pending`.
- **Current next action:** run the exact frontend checks, push the isolated upgrade, then rescan/review Republish in Replit.

## Goal

Resolve or formally disposition Replit Security Center's two unresolved medium
dependency findings for `vitest` and `@vitest/mocker` v4.1.10 so approved
publishes are not blocked, without weakening tests or accepting an unreviewed
dependency change.

## Entry point

The frontend dependency manifest/lockfile and Replit Security Center scan for
the reviewed `main` revision.

## Acceptance criteria

- [ ] The exact advisory identifiers, affected dependency paths, and fixed
  versions (if available) are recorded from the authoritative package/advisory
  source; no version is guessed from the scanner label alone.
- [ ] Either `frontend/package.json` and `frontend/package-lock.json` are
  updated to a reviewed fixed version with `npm ci`, lint, typecheck, Vitest,
  and build passing, or a documented security-center disposition explains why
  the finding is a non-actionable false positive/platform report and is
  accepted by the owner.
- [ ] No production runtime dependency, test coverage, or CI gate is weakened
  to silence the scanner.
- [ ] Replit Security Center no longer blocks Republish, or the exact owner
  decision and remaining platform boundary are recorded on #633/#622.
- [ ] The resulting lockfile/manifests contain no secrets and the dependency
  change is isolated to this issue.

## Evidence captured

- npm advisory: `GHSA-82fw-gwwq-j7x9` (Vitest path traversal/arbitrary file
  read through `@vitest/mocker`), fixed range begins at `4.1.11`.
- `npm install --save-dev vitest@4.1.11` updated the Vitest family and lockfile;
  `npm audit` now reports `0 vulnerabilities`.

## Verification

- `npm --prefix frontend ci`
- `make frontend-lint frontend-format-check frontend-typecheck frontend-test`
- `npm --prefix frontend run build`
- Replit Security Center scan and Republish review for the exact pushed SHA.

## Dependencies

- #633 — production-safe importer publish.
- #622 — production release evidence gate.

## Out of scope

- Rewriting Vitest tests or reducing CI coverage to hide the finding.
- Unrelated dependency upgrades or application security redesign.
- Running a production database import.

## Routing hint

Stage 2a mechanical dependency/security remediation if a fixed version is
authoritatively identified; otherwise stage 2b complex/security review for a
platform disposition. Do not add a dependency without owner approval.
