# Issue #720 — unify personal gallery and renderer filter labels

## Transaction ledger

- **Phase:** CLOSED — QA PASS
- **Implementation commits:** `9dc300d`, `7fc48f2`
- **QA evidence:** 45 focused Gallery/PublicGallery tests passed; frontend
  typecheck and Prettier format check passed.
- **GitHub closure evidence:** QA self-review was posted and the issue was
  closed in the authenticated active Chrome session.

## Self-review

The personal gallery now renders one owner-scoped grid with an explicit All /
2D / 3D renderer filter, while public gallery filtering uses the concise All
label. Existing links, delete callbacks, create actions, and empty states are
covered by the focused tests. No public API or production data mutation was
required.
