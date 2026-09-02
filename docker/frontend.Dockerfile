FROM node:22-bookworm-slim

WORKDIR /app

COPY frontend/package.json frontend/package-lock.json ./frontend/
RUN cd frontend && npm ci

COPY frontend ./frontend
COPY schema ./schema

WORKDIR /app/frontend
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5000"]
