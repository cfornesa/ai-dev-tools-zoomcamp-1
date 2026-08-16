Layout

- Backend: Django project at the repo root (`manage.py`, `config/`, `tests/`)
- Frontend: React/TypeScript/Vite app in `frontend/`

Commands

Backend (run from the repo root):

- `uv sync` - install dependencies
- `uv run pytest` - the whole suite
- `uv run pytest tests/test_home.py` - one test file

Frontend (run from `frontend/`):

- `npm install` - install dependencies
- `npm test` - the whole suite (`vitest run`)
- `npm run build` - type-check and production build

Rules

- Dependencies are added in `pyproject.toml`. Do not add one without asking

Documents

- `_docs/process.md` - how work is organized