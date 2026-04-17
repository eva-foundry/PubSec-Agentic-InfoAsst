# EVA Agentic — an evolution of the Information Assistant agent template

EVA Agentic is a proposed next iteration of Microsoft's [Information Assistant (IA) agent template](https://github.com/microsoft/PubSec-Info-Assistant), rebuilt around a governed, multi-step agentic assistant for the Canadian public-sector deployment context (ESDC). It keeps the IA template's core idea — "chat with your own data" via the RAG pattern over Azure AI Search and Azure OpenAI — and extends it with agentic planning, a tool registry, Responsible-AI (AICM) gates, bilingual (EN/FR) operation, and FinOps cost attribution.

This repo is a working rewrite maintained alongside the IA baseline. Everything here is meant to be reviewable as a proposed PR upstream.

## Table of Contents

- [Response generation approaches](#response-generation-approaches)
- [Features](#features)
- [Azure account requirements](#azure-account-requirements)
- [Azure deployment](#azure-deployment)
- [Secure mode deployment](#secure-mode-deployment)
- [Bilingual and accessibility baseline](#bilingual-and-accessibility-baseline)
- [Protected B and ITSG-33 posture](#protected-b-and-itsg-33-posture)
- [Responsible AI](#responsible-ai)
- [Shared responsibility](#shared-responsibility)
- [Resources](#resources)

## Response generation approaches

Building on the IA template's four response modes, with Canadian-context additions:

**Work (Grounded).** Retrieval-Augmented Generation against the tenant's own dataset, with pinpoint citations to the exact chunks used. Hybrid keyword + vector + semantic reranking over Azure AI Search (HNSW, cosine). Response always carries source anchors, freshness timestamps, and a confidence score.

**Ungrounded.** Direct LLM generation without retrieval — ideation, brainstorming, hypothetical exploration. Marked explicitly in the UI and excluded from audit chains that require grounded output.

**Work and Web.** Parallel RAG + web-search responses with optional comparative synthesis. Web citations required on web-sourced content.

**Agentic (AICM-gated).** ReAct-style planner that decomposes a question into tool calls against a governed tool registry. Every tool declares its classification ceiling, data residency, bilingual support, and whether HITL is required. Agentic responses at AICM Level 2 or above enforce a human-in-the-loop checkpoint before the answer surfaces.

## Features

- **Custom RAG pipeline** — document ingestion → Form Recognizer/layout parsing → chunking (token-based, section/title aware) → embeddings → Azure AI Search hybrid index
- **Governed tool registry** — every tool registers with classification ceiling, residency, bilingual support, HITL flag
- **AICM gates** — Level 1 advisory vs Level 2+ decision-informing, with HITL enforcement on the latter
- **Bilingual EN/FR** — language-parameterized prompts, translation as a first-class tool, auto-routing for non-bilingual tools
- **Explainable responses** — every answer carries retrieval path, reasoning trace, negative evidence, source freshness, and behavioural fingerprint (model + prompt + corpus + policy versions)
- **FinOps cost attribution** — every AI call routes through APIM with `x-app-id`, `x-user-group`, `x-classification` headers
- **Three-portal management surface** — self-service (workspace booking), business management (client onboarding), ops & support (FinOps, AIOps, LiveOps, DevOps)
- **Accessible step indicators** — agentic planner steps are screen-reader announced

See [Agentic-State-Vision.md](Agentic-State-Vision.md) and [EVA-Design-Principles-Beyond-Agentic-State.md](EVA-Design-Principles-Beyond-Agentic-State.md) for the architectural principles behind these features.

## Azure account requirements

- **Azure subscription** with Azure OpenAI service access. Models required:

  | Model | Notes |
  |---|---|
  | gpt-4o | default generation |
  | gpt-4o-mini | classification, routing, cheap calls |
  | text-embedding-3-small or -large | index embeddings |

- **Azure AI Search** — Standard tier or above (HNSW vector index, semantic reranker)
- **Azure Document Intelligence** — PDF layout parsing
- **Azure AI Foundry** — hub for tool registry, evaluations, safety evals, tracing. Hub in Canada Central, private endpoint, VNet.
- **Azure API Management** — the single public edge for all AI calls (FinOps header enforcement)
- **Entra ID tenant** — SSO + group-based RBAC
- **Canada Central / Canada East regions only** — no public IPs, SCED/VNet traffic only (see [Protected B posture](#protected-b-and-itsg-33-posture))

## Azure deployment

```bash
# One-command local setup
make install

# Full local stack (Azurite blob, Jaeger tracing, API on :8000, portal on :5173)
make dev

# Or Docker Compose
make docker-up
```

### Manual start

```bash
# Terminal 1 — backend
docker compose up -d azurite jaeger
.venv/bin/uvicorn services.api-gateway.app.main:app --reload --port 8000

# Terminal 2 — frontend
npm run dev --workspace=@eva/portal-unified
```

Local service URLs:

| Service | URL |
|---|---|
| API Gateway | http://localhost:8000 |
| Portal (Lovable UI) | http://localhost:5173 |
| Jaeger UI | http://localhost:16686 |
| Azurite Blob | http://localhost:10000 |

Bicep IaC for Azure deployment lives in [`infra/`](infra/) (Canada Central, private endpoints, VNet, APIM, AI Foundry hub).

## Secure mode deployment

All deployments targeting Protected B data must:

- use private endpoints for every Azure resource (no public network access)
- route traffic through the tenant's SCED/VNet
- pin AI Search and Azure OpenAI to Canada Central or Canada East
- use Entra ID + managed identity (no API keys in production)
- enable Azure AI Content Safety with prompt-injection defense + content filtering
- enable Log Analytics + Foundry tracing with dual-auth gated access (anonymized logs only)

See [Road-to-ATO-n-Continuous-Authorization.md](Road-to-ATO-n-Continuous-Authorization.md) for the ATO roadmap.

## Bilingual and accessibility baseline

- **WCAG 2.1 AA** floor, EN 301 549 target — keyboard navigation, screen reader, high contrast, resize, STT/TTS
- **GC Design System** (`@cdssnc/gcds-components-react`) for mandatory Government of Canada chrome
- **React 19 + Vite 6 + TypeScript 5.7** application layer with shadcn/ui + Radix UI + Tailwind v4
- **`react-i18next` + `{en,fr}.json`** — all strings externalized, no hardcoded text
- **`axe-core` + screen-reader testing** in CI

## Protected B and ITSG-33 posture

This rewrite targets deployment for Canadian government Protected B data. Controls in scope:

- **AC** — Entra ID + group RBAC (Reader/Contributor/Admin), enforced at APIM and AI Foundry Hub
- **AU** — Log Analytics + Foundry tracing, weekly log review, dual-auth gated access, no PII in logs
- **CM** — baseline config + versioning for tools, prompts, models, policies (the "behavioural fingerprint")
- **IA** — Entra SSO, dual-auth on log/database access
- **SC** — TLS 1.3, encryption at rest, private endpoints, VNet, Canada Central/East only
- **SI** — Azure Content Safety, prompt-injection defense, grounding enforcement, citation requirement
- **SA** — Foundry safety evals, OWASP Top 10 for LLM, MITRE ATLAS, Google SAIF, NIST AI RMF, ISO/IEC 42001:2023

## Responsible AI

- **No retraining on user data** (AUD06)
- **Anonymized logs** — no PII in Azure Log Analytics
- **RAG-first** — retrieve from trusted sources, generate with pinpoint citations; no fine-tuning for domain knowledge
- **AICM gates** — advisory (Level 1) vs decision-informing (Level 2+); mandatory HITL on Level 2+
- **Explainable reasoning** — citations, retrieval path, negative evidence on every answer, regardless of AICM level
- **Transparency** — behavioural fingerprint (model + prompt + corpus + policy versions) recorded on every response

## Shared responsibility

This template provides the agentic chassis, governance gates, and reference configuration. The deploying organization is responsible for:

- tenant-specific Entra ID group design and RBAC assignments
- content classification and corpus curation
- AICM level decisions per workspace and per use case
- legal review of the tool registry (classification ceilings, residency)
- ongoing log review, incident response, and ATO maintenance

## Resources

### Monorepo structure

```
apps/
  portal-unified/        # Single React 19 + Vite 6 portal app (Lovable UI)
packages/
  eva-common/            # Shared types, utilities, API clients
  eva-ui-kit/            # Reusable GC-Design-System-aware components
services/
  api-gateway/           # FastAPI orchestrator (auth, guardrails, RAG, chat, agents)
  doc-pipeline/          # Azure Functions (PDF extract, enrich, embed, chunk)
  enrichment/            # Embeddings microservice
infra/                   # Bicep IaC (Canada Central, private endpoints, VNet)
tests/
  e2e/                   # Playwright end-to-end + visual regression
docs/                    # ADRs, compliance evidence, archived implementation notes
```

### Key commands

| Command | What it does |
|---|---|
| `make install` | Install all Node + Python dependencies |
| `make dev` | Start full local dev stack |
| `make build` | Build all workspaces |
| `make test` | Run npm + pytest suites |
| `make lint` | Ruff (Python) + ESLint (portal-unified) |
| `make docker-up` | Start Docker Compose stack |
| `make docker-down` | Stop Docker Compose stack |

### Configuration

```bash
cp services/api-gateway/.env.example services/api-gateway/.env
```

Key settings:

| Variable | Purpose |
|---|---|
| `AZURE_OPENAI_ENDPOINT` | Azure OpenAI endpoint URL |
| `AZURE_OPENAI_API_KEY` | API key (dev only; prod uses managed identity) |
| `AUTH_MODE` | `demo` (no auth) or `production` (Entra ID) |
| `EVA_DEBUG` | Enable debug mode |

### Documentation

- [CLAUDE.md](CLAUDE.md) — authoritative project constraints and architecture guidance
- [Agentic-State-Vision.md](Agentic-State-Vision.md) — design principles (Ilves & Kilian, 2025)
- [EVA-Design-Principles-Beyond-Agentic-State.md](EVA-Design-Principles-Beyond-Agentic-State.md) — complementary principles
- [Road-to-ATO-n-Continuous-Authorization.md](Road-to-ATO-n-Continuous-Authorization.md) — ATO roadmap
- [docs/adr/](docs/adr/) — architectural decision records
- [docs/compliance/](docs/compliance/) — compliance evidence
- [docs/archive/](docs/archive/) — historical implementation notes from the build

### Related projects

| Repo | Relationship |
|---|---|
| [microsoft/PubSec-Info-Assistant](https://github.com/microsoft/PubSec-Info-Assistant) | Upstream baseline — this repo is a proposed evolution |
| `75-EVA-vNext` | Infrastructure chassis — APIM, AI Foundry, VNet, Cosmos DB (sibling Canadian-context project) |
| `77-FinOps-TK` | FinOps reference architecture consumed via P75 APIs |

### Reporting security issues

Please follow the upstream template's [SECURITY.md](https://github.com/microsoft/PubSec-Info-Assistant/blob/main/SECURITY.md) for coordinated disclosure.
