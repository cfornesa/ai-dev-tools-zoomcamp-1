# Python/Django conventions

Scope: `backend/`. See [`CONVENTIONS.md`](../../CONVENTIONS.md) for the
standing mandate and the architecture correction.

## What's already good here — codify it, don't replace it

- **Private-helper naming.** A leading underscore marks anything internal
  to a module. `backend/scenes/validation.py`'s `_format_path`,
  `_check_structure`, `_check_non_finite_numbers`, `_check_forbidden_node_
  types`, `_check_references`, `_check_limits` are all private, feeding one
  public `validate_scene()`. `backend/scenes/patch.py`'s ~24 top-level
  functions follow the same shape (`_split_pointer`, `_apply_one`,
  `_resolve_parent`, one function per JSON-patch verb). `backend/scenes/
  permissions.py`'s `_is_authenticated`/`_is_owner`/`_is_owner_3d` feed the
  two public `can()`/`require()`.
  **Rule:** any new module-private helper gets the underscore prefix. If a
  module curates a public surface, add/maintain an explicit `__all__` (used
  in `ai_api.py`, `ai_api3d.py`, `ai_catalog.py`, `art_piece_api.py`,
  `patch.py`, `patch3d.py`, `thumbnails3d.py`, and others).
- **`<domain>.py` / `<domain>_api.py` pairing.** Pure logic and DRF views
  are separate files across `backend/scenes/`'s ~90 files: `billing.py`/
  `billing_api.py`, `account_deletion.py`/`account_deletion_api.py`,
  `admin_content.py`/`admin_content_api.py`, `cloud_backup.py`/
  `cloud_backup_api.py`. **Rule:** new domain slices follow this pairing —
  don't mix logic and view code in one file.
- **Function atomicity, calibrated to what's already here.** Many small,
  single-purpose functions per file is the goal — not a problem. `patch.py`
  (879 lines) has ~24 functions, each owning one verb or one parsing
  concern. `validation.py`'s `validate_scene()` is a short-circuiting
  pipeline of `_check_*` functions, each scoped to one rule category (its
  own docstring: "each stage short-circuits the next so errors stay
  specific instead of cascading into noise"). `permissions.py`'s `can()` is
  a 74-line dispatcher, but it's a flat sequence of `if action == X: return
  ...` guard clauses — one action-check per block, not nested logic.
  **The actual antipattern:** one function doing many unrelated things, not
  a file holding many small functions. If a function's docstring needs
  "and" to describe what it does, split it.
- **Docstrings cite the originating issue and explain why.** Every sampled
  module (`validation.py`, `patch.py`, `permissions.py`) opens with a
  docstring naming the GitHub issue/task that motivated it and the design
  rationale, not just a description of the code. Keep doing this — it's
  why this session could reconstruct real conventions from the code alone.
- **No mutable module-level globals.** Confirmed: none exist in `backend/
  scenes/` or `backend/ai_provider/`. Every module-level assignment is an
  immutable constant/lookup table (`frozenset`s, dicts, some `Final`-
  annotated — e.g. `piece_engine.py`'s `_SCENE2D_RENDERER_TO_ENGINE: Final`).
  The one sanctioned "global config" layer is `backend/backend/settings.py`,
  computed once at process start from env vars via two typed helpers:
  `get_required_env(name)` (raises `ImproperlyConfigured` if missing) and
  `get_bool_env(name, default)`. **Rule:** new config values go through
  those two helpers, not ad hoc `os.environ` reads scattered elsewhere; new
  code does not introduce a mutable module-level global without a stated
  reason and sign-off — this codebase has managed to avoid them entirely so
  far, and that's worth protecting.

## Env-var discipline (operationalizes "don't break env vars")

`backend/.env.example` is the authoritative, heavily-commented manifest of
every variable Django reads, grouped by concern, each noting required-vs-
optional, its default, and (often) the originating issue. **Rule:** any
change to an env var read in `settings.py` (rename, removal, new required
var) updates `.env.example` in the same change. If it's one of the three
port-synced values (`frontend/vite.config.ts`'s port, `CSRF_TRUSTED_
ORIGINS`, the Google OAuth redirect URI), `AGENTS.md`'s port-sync section
also gets updated in the same change. New optional features default to
*disabled* when unset — the existing pattern for GitHub/LinkedIn OAuth and
PayPal ("setting only one of the two variables is a startup configuration
error, not a valid half-enabled state").

## Known hygiene gap (filed, not fixed here)

`backend/pyproject.toml` declares `cryptography` twice with two different
version constraints (`>=50.0.0` and `>=46.0.0`) — an accidental duplicate,
not policy. See the filed issue for the fix.

## What's not yet machine-enforced

Ruff's `select` is `["E","F","I","UP","B","DJ"]` — no complexity (`C90`),
naming (`N`), or too-many-arguments (`PLR0913`) rule is enabled. Mypy uses
the django-stubs plugin but isn't globally `strict`. See `CONVENTIONS.md`'s
enforcement table and the tracked incremental-rollout issue before assuming
either exists today.
