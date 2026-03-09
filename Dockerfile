# Stage 1: Build frontend
FROM node:20-slim AS frontend-build
WORKDIR /build
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Python runtime
FROM python:3.10-slim
WORKDIR /app

# Install Python deps
COPY pyproject.toml ./
RUN pip install --no-cache-dir .

# Copy backend
COPY backend/ ./backend/

# Copy built frontend
COPY --from=frontend-build /build/dist ./frontend/dist

EXPOSE 8080

CMD ["sh", "-c", "uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-8080}"]
