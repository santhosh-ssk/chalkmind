.PHONY: dev dev-frontend dev-backend build install clean docker-build deploy

# Install all dependencies
install:
	cd frontend && npm install
	$(VENV)/pip install -e .

# Run frontend dev server
dev-frontend:
	cd frontend && npm run dev

# Run backend dev server (uses project venv)
VENV := $(shell cd .. && pwd)/.venv/bin
dev-backend:
	$(VENV)/uvicorn backend.main:app --reload --port 8000

# Run both in parallel
dev:
	@echo "Starting frontend (localhost:5173) and backend (localhost:8000)..."
	$(MAKE) -j2 dev-frontend dev-backend

# Build frontend for production
build:
	cd frontend && npm run build

# Build Docker image
docker-build:
	docker build -t chalkmind .

# Deploy via Cloud Build
deploy:
	gcloud builds submit --config=cloudbuild.yaml .

# Clean build artifacts
clean:
	rm -rf frontend/dist frontend/node_modules
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
