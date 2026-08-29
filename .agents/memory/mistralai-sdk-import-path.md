---
name: mistralai-sdk-import-path
description: The installed mistralai SDK has no top-level Mistral export; import it from mistralai.client, not mistralai.
metadata:
  type: project
---

The installed `mistralai` package (pinned `>=2.9.3`) is a namespace
package with no `Mistral` symbol at its top level. `from mistralai import
Mistral` raises `ImportError: cannot import name 'Mistral' from
'mistralai'`; the working import is `from mistralai.client import
Mistral`. Likewise, `MistralError` lives at `mistralai.client.errors`, not
`mistralai.errors`.

**Why:** `ai_provider/art_piece_provider.py`'s `client` property used the
wrong top-level import. Because that import runs inside `generate()`'s
`try` block, the resulting `ImportError` was caught by the broad `except
Exception`, failed the `isinstance(exc, MistralError)` check, and
re-raised — producing a fast (~700ms), unhandled 500 for every
art-piece-generation library in production ([issue
#203](https://github.com/cfornesa/ai-dev-tools-zoomcamp-1/issues/203)).
`ai_provider/mistral_provider.py` had the correct `from mistralai.client
import Mistral` all along, so the scene-creation endpoint never hit this.
Every existing art-piece test mocked `get_art_piece_provider` or injected
a fake client, so none of them ever executed the real import path — the
gap that let this reach production.

**How to apply:** Any new code that constructs the Mistral SDK client or
catches its error types directly (not through
`ai_provider/mistral_provider.py` or `ai_provider/art_piece_provider.py`,
which are already correct) must import from `mistralai.client`
(`mistralai.client.Mistral`, `mistralai.client.errors.MistralError`), not
bare `mistralai`. When adding a new AI-provider module that talks to
Mistral directly, add a test that exercises the *real* import/construction
path (like `tests/test_art_piece_provider.py`'s
`test_client_property_builds_a_real_client_from_the_real_sdk_import_path`)
rather than only testing through a fully mocked provider/client — a fully
mocked seam cannot catch an import-path regression like this one.
