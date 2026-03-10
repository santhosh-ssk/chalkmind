# Stage 1: Build frontend
FROM node:20-slim AS frontend-build
WORKDIR /build
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./

# Vite bakes VITE_* env vars at build time
ARG VITE_GA_MEASUREMENT_ID
ARG VITE_RECAPTCHA_SITE_KEY
ENV VITE_GA_MEASUREMENT_ID=$VITE_GA_MEASUREMENT_ID
ENV VITE_RECAPTCHA_SITE_KEY=$VITE_RECAPTCHA_SITE_KEY

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
