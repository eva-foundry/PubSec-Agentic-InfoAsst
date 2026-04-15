# EVA Agentic

Governed, multi-step agentic AI assistant platform for ESDC. Rebuilt from Microsoft's PubSec-Info-Assistant baseline, aligned to the [AI Reference Architecture (AIRA)](https://wiki.gccollab.ca/) and EVA Foundation Technical Design & ConOps v0.4.

All output merges back into the EVA Foundation shared trunk (`../75-EVA-vNext`).

## Architecture

Six-layer stack:

| Layer | Responsibility | Technology |
|-------|---------------|------------|
| **L1 UI** | Three bilingual portals (WCAG 2.1 AA) | React 19, Vite 6, TypeScript 5.7, GC Design System, Tailwind v4 |
| **L2 API** | Gateway, auth, FinOps headers | FastAPI, Python 3.12, Entra ID SSO |
| **L3 Orchestration** | ReAct loop, tool registry, memory | Azure AI Foundry, Prompt Flow |
| **L4 Guardrails** | Content safety, prompt injection, citations | Azure Content Safety, AICM gates |
| **L5 LLM** | Language model inference | Azure OpenAI (GPT-4o) via APIM |
| **L6 Data** | Hybrid search, document storage | Azure AI Search (HNSW), Blob, Cosmos DB |

## Monorepo structure

```
apps/
  portal-self-service/   # Customer-facing: workspace booking, team RBAC, surveys
  portal-admin/          # AICoE admin: client onboarding, workspace assignment
  portal-ops/            # Operations: FinOps, AIOps, LiveOps dashboards
packages/
  eva-common/            # Shared types, utilities, API clients
  eva-ui-kit/            # Reusable React components (GC Design System)
services/
  api-gateway/           # FastAPI orchestrator (auth, guardrails, RAG, chat)
  doc-pipeline/          # Azure Functions (PDF extract, enrich, embed, chunk)
  enrichment/            # Embeddings microservice
infra/                   # Bicep IaC (Canada Central, private endpoints, VNet)
scripts/
  red-team/              # OWASP Top 10 LLM + MITRE ATLAS attack scenarios
  certify/               # Automated ITSG-33 + EVA compliance certification
  backup/                # Disaster recovery drills
```

## Prerequisites

- Node.js >= 20
- Python 3.12+
- Docker & Docker Compose

## Quick start

```bash
# One-command setup (npm install + Python venv + deps)
make install

# Start local dev (Azurite, Jaeger, API on :8000, portal on :5173)
make dev

# Or full Docker stack
make docker-up
```

### Manual start

```bash
# Terminal 1 — backend
docker compose up -d azurite jaeger
.venv/bin/uvicorn services.api-gateway.app.main:app --reload --port 8000

# Terminal 2 — frontend
npm run dev --workspace=@eva/portal-self-service
```

## Key commands

| Command | What it does |
|---------|-------------|
| `make install` | Install all Node + Python dependencies |
| `make dev` | Start full local dev stack |
| `make build` | Build all workspaces |
| `make test` | Run npm + pytest suites |
| `make lint` | Ruff (Python) + ESLint (TypeScript) |
| `make docker-up` | Start Docker Compose stack |
| `make docker-down` | Stop Docker Compose stack |

## Local services

| Service | URL |
|---------|-----|
| API Gateway | `http://localhost:8000` |
| Self-Service Portal | `http://localhost:5173` |
| Jaeger UI (tracing) | `http://localhost:16686` |
| Azurite Blob | `http://localhost:10000` |

## Configuration

Copy the example env file and adjust as needed:

```bash
cp services/api-gateway/.env.example services/api-gateway/.env
```

Key settings:

| Variable | Purpose |
|----------|---------|
| `AZURE_OPENAI_ENDPOINT` | Azure OpenAI endpoint URL |
| `AZURE_OPENAI_API_KEY` | API key (dev only; prod uses managed identity) |
| `AUTH_MODE` | `demo` (no auth) or `production` (Entra ID) |
| `EVA_DEBUG` | Enable debug mode |

## Compliance & security

All work must satisfy:

- **Protected B** -- compute/data in Canada Central/East only, no public IPs, SCED/VNet
- **ITSG-33** -- access control, audit, config management, identification, system protection
- **WCAG 2.1 AA** -- keyboard nav, screen reader, high contrast, bilingual EN/FR
- **AICM gates** -- HITL checkpoint at Level 2+, explainable reasoning with citations
- **FinOps** -- all AI calls via APIM with cost-attribution headers

### Automated checks

```bash
# Security red-team (14 attack scenarios)
python3 scripts/red-team/run_red_team.py --base-url http://localhost:8000 --output evidence/red-team/

# Compliance certification (35 controls)
python3 scripts/certify/run_certification.py --env staging --output evidence/

# Backup recovery drill (8 tests)
python3 scripts/backup/test_recovery.py --env staging --output evidence/backup/
```

## CI/CD

GitHub Actions workflows in `.github/workflows/`:

| Workflow | Schedule | Purpose |
|----------|----------|---------|
| `ci.yml` | On push / weekly | Lint + type-check |
| `red-team.yml` | Monday 6:00 UTC | Security red-team |
| `recovery-drill.yml` | Sunday 7:00 UTC | Backup recovery drill |

## Related projects

| Repo | Relationship |
|------|-------------|
| `75-EVA-vNext` | Infrastructure chassis -- APIM, AI Foundry, VNet, Cosmos DB |
| `77-FinOps-TK` | FinOps reference architecture -- consumed via P75 APIs |
| `46-accelerator` | GitHub Spark PoC -- UX patterns harvested |
| `PubSec-Info-Assistant` | Microsoft baseline -- functional requirements reference |

## Documentation

- [CLAUDE.md](CLAUDE.md) -- authoritative project constraints and architecture guidance
- [PLAN.md](PLAN.md) -- strategic roadmap
- [Agentic-State-Vision.md](Agentic-State-Vision.md) -- design principles (Ilves & Kilian 2025)
- [Road-to-ATO-n-Continuous-Authorization.md](Road-to-ATO-n-Continuous-Authorization.md) -- ATO roadmap
