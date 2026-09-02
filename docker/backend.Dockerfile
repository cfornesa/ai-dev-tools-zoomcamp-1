FROM ghcr.io/astral-sh/uv:python3.13-bookworm-slim

WORKDIR /app

COPY backend/pyproject.toml backend/uv.lock ./backend/
RUN cd backend && uv sync --locked --no-dev

COPY backend ./backend

WORKDIR /app/backend
CMD ["sh", "-c", "uv run python manage.py migrate --noinput && uv run python manage.py runserver 0.0.0.0:8000"]
