"""ASGI entry point for uvicorn.

Task 217 (issue #249): after the backend restructure, `backend/manage.py`
and this package (`backend/backend/`, renamed from the former top-level
`config/`) live under `backend/`. Run uvicorn from inside `backend/` so this
directory is importable as the top-level `backend` package, then point it at
`backend.main:app`:

    cd backend && uv run --with uvicorn uvicorn backend.main:app --reload --port 8091

(`uvicorn` is not a declared project dependency -- `--with uvicorn` installs
it into uv's ephemeral run environment instead of pyproject.toml; see
AGENTS.md's Rules section and the Makefile's `run` target.)

It just re-exports `backend.asgi`'s `application` as `app`, which is the
attribute name uvicorn's `module:attribute` target convention expects.
"""

from backend.asgi import application as app

__all__ = ["app"]
