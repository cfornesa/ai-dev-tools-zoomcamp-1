## PM/grooming handoff — #616

- **Issue:** [Canonical regular art-piece slug resolution and legacy shim](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/616)
- **Parent:** #600, which remains a reconciliation container for the broader slug family.
- **Closure slice:** one published regular generated-piece route, one owner-scoped slug mutation/resolution policy, and the existing UUID/public-id regular shim.
- **Out of scope:** immersive/editor/embed/studio/card/thumbnail/runtime consumers, which remain in their linked issues.
- **Routing:** stage 2b complex; URL structure is an irreversible public-interface change and requires `docs/api.md` plus compatibility and rollback evidence before implementation.
- **Fixed evidence:** disposable PostgreSQL-backed fixture, regular route at 1280x900 and 375x812, anonymous/other-user/draft/archived/missing boundaries.
- **Next action:** engineer #616 only after re-reading the body and documenting the exact redirect/shim behavior in the implementation plan.
