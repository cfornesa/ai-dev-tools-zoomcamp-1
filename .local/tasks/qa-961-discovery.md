## Discovery evidence

Authenticated active Chrome reproduced the defect on local disposable fixture
`e2e-manual-ink-921`: selecting `Ink layer · ink` and accepting a normal
refinement changed the stored SVG source from `fill="teal"` to
`fill="#e76f51"` while the target was `@ink`. Version history advanced, but
the source—not only `generation_metadata.ink`—changed. This issue owns the
implementation correction; #921 owns the browser verification contract.

## QA / reconciliation

The implementation is recorded in the #961 GitHub issue. Focused backend tests
and the full repository gate pass. After rebuilding the local Compose backend
from the checkout, active Chrome normal clicks at 1280x900 and 375x812 accepted
an ink-targeted refinement. Local disposable DB inspection confirmed the new
version preserved source bytes and changed only the validated ink metadata.
Closure comment: https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/961#issuecomment-5854146403.
