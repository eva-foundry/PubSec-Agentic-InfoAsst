.PHONY: install dev build test lint docker-up docker-down

install:
	npm install
	python3 -m venv .venv
	.venv/bin/pip install -r services/api-gateway/requirements.txt
	.venv/bin/pip install -r services/doc-pipeline/requirements.txt
	.venv/bin/pip install -r services/enrichment/requirements.txt
	.venv/bin/pip install ruff pyright pytest httpx

dev:
	docker compose up -d azurite jaeger
	.venv/bin/uvicorn services.api-gateway.app.main:app --reload --port 8000 &
	npm run dev --workspace=@eva/portal-self-service

build:
	npm run build --workspaces --if-present

test:
	npm run test --workspaces --if-present
	.venv/bin/pytest services/api-gateway/tests/

lint:
	npm run lint --workspaces --if-present
	.venv/bin/ruff check services/

docker-up:
	docker compose up --build -d

docker-down:
	docker compose down
