# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## What this project is

**EVA Agentic** — rebuild of EVA Domain Assistant (currently based on Microsoft's PubSec-Info-Assistant) into a governed, multi-step agentic assistant aligned to ESDC's AI Reference Architecture (AIRA, EARB approved Jan 2025) and EVA Foundation Technical Design & ConOps v0.4 (March 2025).

This is not a standalone fork. All output merges back into the EVA Foundation shared trunk.

## Source repos (siblings in `../`)

| Path | Role | Harvest | Discard |
|------|------|---------|---------|
| `../46-accelerator` | GitHub Spark PoC — 30-min demo shell for Portal 1 (self-service). Validates UX for workspace booking, team RBAC, surveys, cost recovery, admin dashboard. One of three portals in the full EVA DA management system. | UX patterns for workspace/index management, RBAC model (Reader/Contributor/Admin), entry/exit survey flow, admin KPI dashboard, Brain v2 client (`src/lib/brain-client.ts`) with cost-tag headers | Spark KV persistence, demo pricing, no real auth — all replaced by Azure-native equivalents |
| `../PubSec-Info-Assistant` | Current EVA DA baseline (Microsoft) — **functional requirements reference only**, no code ported | What needs to work: upload, chunk, embed, search, chat with citations, document status tracking, file deletion with index cleanup | All implementation: linear pipeline, static prompts, no observability, no provenance |
| `../open-webui` | Open-source LLM wrapper platform — **platform management patterns reference** | Model registry (admin enable/disable, parameter overrides, per-group access), function valves (schema-driven tool config), prompt versioning with rollback, evaluation arena (Elo-based model comparison), persistent memories, pluggable RAG backends (vector DB/reranker/embeddings factory), artifact storage for stateful agents, content extraction engine abstraction | SvelteKit frontend, Ollama direct integration, 15 web search providers, RestrictedPython sandboxing |
| `../75-EVA-vNext` | **P53's infrastructure chassis** — NOT reference, P53 is a product on this chassis | APIM public edge, Azure AI Foundry + OpenAI (gpt-5-mini, gpt-5.1), AI Search, Document Intelligence, Service Bus execution bus, VNet with private endpoints, Cosmos DB canonical model, Entra ID + JWT/JWKS, OpenTelemetry, Application Insights. P53 does NOT build parallel infrastructure. | — |
| `../77-FinOps-TK` | **FinOps reference architecture** — 8 phases complete, production surface in P75 | Cost extraction (FOCUS 1.2-preview), executive metrics contract, waste score algorithm, AOE gate logic, security FinOps bridge. P53 FinOps Command Center consumes P75 APIs (`/v1/products/aca/*`), does NOT rebuild. | — |

## Source repo commands (for reference/testing during harvest)

### 46-accelerator (GitHub Spark PoC — React/Vite/TypeScript)
```bash
cd ../46-accelerator
npm install
npm run dev          # Vite dev server on :5173, proxies /api/brain → localhost:8001
npm run build        # tsc + vite build
npm run lint         # ESLint
```
Live PoC: `eva-domain-assistant--marcopolo483.github.app`

### PubSec-Info-Assistant (Python/FastAPI + React + Azure Functions)
```bash
cd ../PubSec-Info-Assistant
make build                          # Full application build
make infrastructure                 # Terraform deploy
make build-deploy-webapp            # Backend + frontend
make build-deploy-functions         # Azure Functions
make build-deploy-enrichments       # Embedding microservice
make run-backend-tests              # pytest ./app/backend/testsuite.py
make functional-tests               # End-to-end pipeline tests
cd app/frontend && npm run build    # Frontend builds into /app/backend/static/
```

---

## Target architecture (six layers)

```
┌─────────────────────────────────────────────────────────┐
│ L1  EVA UI — WCAG 2.1 AA, bilingual EN/FR, agentic     │
│     step indicators (screen-reader-announced)           │
├─────────────────────────────────────────────────────────┤
│ L2  APIM Gateway — Entra ID SSO, FinOps headers        │
│     (x-app-id, x-user-group, x-classification),        │
│     rate limits, SCED/VNet only                         │
├─────────────────────────────────────────────────────────┤
│ L3  Agent Orchestrator (Azure AI Foundry)               │
│     ┌──────────┐ ┌──────────────┐ ┌──────────┐         │
│     │ Planner  │ │ Tool Registry│ │ Memory   │         │
│     │ ReAct    │ │ classification│ │ Redis/   │         │
│     │ loop +   │ │ ceiling,     │ │ Cosmos + │         │
│     │ step     │ │ residency,   │ │ AI Search│         │
│     │ reflect  │ │ bilingual,   │ │ vector + │         │
│     │          │ │ HITL flag    │ │ Postgres │         │
│     └──────────┘ └──────────────┘ └──────────┘         │
├─────────────────────────────────────────────────────────┤
│ L4  Guardrails & Responsible AI (AICM)                  │
│     Content Safety, prompt injection defense,           │
│     grounding enforcement, citation requirement,        │
│     HITL checkpoints (AICM L2+), audit trail            │
├─────────────────────────────────────────────────────────┤
│ L5  Azure OpenAI — GPT-4o default, managed via Foundry  │
├─────────────────────────────────────────────────────────┤
│ L6  Knowledge & Data — AI Search (hybrid), Blob,        │
│     Vector Index, ESDC data sources                     │
└─────────────────────────────────────────────────────────┘

Azure AI Foundry governs L3–L5 (Agent Service runtime, Prompt Flow,
evaluations, safety evals, connections hub, tracing, model catalog).
Foundry Hub: Canada Central, private endpoint, ESDC VNet.
```

### Key pipeline harvested from PubSec-Info-Assistant

```
Blob upload → FileUploadedFunc (routes by extension)
  ├─ .pdf → pdf_submit_queue → Form Recognizer → polling → chunking
  ├─ .docx/.txt/etc → non_pdf_submit_queue → layout parsing → chunking
  ├─ .mp4/.wav → media_submit_queue
  └─ .jpg/.png → image_enrichment_queue
→ TextEnrichment (entities, key phrases, translation)
→ Enrichment microservice (embeddings via Sentence Transformers or Azure OpenAI)
→ Azure AI Search index (HNSW vector + keyword hybrid, semantic reranking)
```

Re-express each stage as a governed Foundry tool with classification ceiling, residency, and bilingual declarations.

### RAG search approach

PubSec uses `chatreadretrieveread.py` with three modes: hybrid semantic (keyword + vector + semantic reranker), pure vector, and BM25 keyword fallback. Chunking is token-based (`cl100k_base`) respecting section/title boundaries with special table handling. Vector index uses HNSW with cosine similarity (configurable 384 or 1536 dimensions).

---

## Hard constraints (non-negotiable)

- **Protected B**: all compute/data in Canada Central / Canada East. No public IPs. All traffic via SCED/VNet.
- **ITSG-33**: AC (Entra ID + RBAC), AU (Log Analytics + Foundry tracing), CM (baseline config + versioning), IA (Entra SSO + dual-auth), SC (TLS 1.3 + encryption at rest), SI (content filtering + prompt injection defense), SA (Foundry safety evals).
- **WCAG 2.1 AA**: keyboard nav, screen reader, high contrast, resize, STT/TTS, accessible agentic step indicators.
- **Bilingual EN/FR**: language-parameterized prompts (not hardcoded). Translation tool is first-class. Non-bilingual tools auto-route through translation.
- **RAG-first**: retrieve from trusted sources, generate with pinpoint citations. No fine-tuning for domain knowledge.
- **All AI calls through Azure APIM**: never direct. FinOps cost-attribution headers on every request.
- **Shared trunk**: all features merge back to EVA Foundation core. Feature branches only.
- **No retraining on user data** (AUD06).
- **Anonymized logs** — no PII in Azure Log Analytics (AUD02/AUD05).

## RBAC model

| Role | Blob Storage | Vector Index |
|------|-------------|-------------|
| Admin | Full control | Full control + Foundry Hub config |
| Contributor | Upload + manage | Manage contributions |
| Viewer | Read/query only | View only (default for end users) |

Enforced at APIM and Foundry Hub level via Entra ID groups.

## AICM gate logic

| AICM Level | Gate |
|------------|------|
| Level 1 (advisory) | No HITL gate — human reviews all outputs post-hoc |
| Level 2+ (decision-informing) | Mandatory HITL checkpoint before response surfaces |

All reasoning chains must be explainable with citations regardless of level.

## Tool registry requirements

Every tool must declare at registration: classification ceiling (Protected B or lower), data residency (Canada Central/East only), bilingual support (yes/no), HITL-required flag. New tools go through change advisory — no shadow tooling.

## Logging requirements

Every agent step must log: tool name, input hash, latency, output hash. Dual authentication for log access (Entra ID + special permissions) and PostgreSQL (Entra ID + AD group). Daily incremental backups. Weekly log review (AUD01).

---

## Use case complexity spectrum

The platform must support the full range — same governance, audit, and cost-attribution backbone throughout:

| Complexity | Example | Interaction pattern |
|------------|---------|-------------------|
| Simplest | **FAQ** | Basic RAG over known content |
| Moderate | **AssistMe** (OAS Act) | Legislation retrieval — hierarchical chunking, cross-reference awareness |
| High | **Jurisprudence** (EI cases) | Case law — citation graphs, court hierarchy ranking, Act-vs-claim mapping |
| Agentic | **Equi'Vision** (Power BI) | AI-assisted dashboard interpretation — query data, explain charts, drill down |
| Most complex | **GovOps** (`../61-GovOps`) | AI-evidenced decision-making: `Law → Policy → Service → Decision` with deterministic rule engine, jurisdiction-aware authority chains, evidence-first evaluation, HITL review, full audit packages |

The data model and retrieval strategy vary radically across this spectrum. The agent orchestrator and tool registry cannot be designed only for document RAG — they must accommodate rule engines, data connectors, and structured reasoning chains at the complex end.

## Resolved design decisions

- **EVA Agentic runs alongside EVA DA, eventually replaces it.** Not a hard cutover — coexistence first, migration later.
- **Use cases are instances, not architectures.** The platform delivers RAG solutions of varying complexity and data models. Project names are configuration of the same pipeline, not separate systems.
- **Data modelling drives retrieval quality.** The design must support per-document-archetype configuration: chunking strategy, metadata schema, entity extraction, relationship mapping. The ingestion pipeline is generic; the data model per document type is what makes search work.
- **AICM level is per data classification + output use, not per project.** Advisory (Level 1) vs. decision-informing (Level 2+) is a property of how the output is consumed, configured per workspace — not hardcoded per use case name.

## EVA DA management system — three portals

The 46-accelerator GitHub Spark app is a 30-minute demo shell validating the UX for **one** of three portals. The full system manages 50+ EVA DA indexes across multiple business clients.

### Portal 1 — Self-Service (customer-facing, PoC'd in 46-accelerator)
Business clients browse workspace catalog, book EVA DA indexes, manage team RBAC (Reader/Contributor/Admin), complete entry/exit surveys, cost recovery. PoC screens: workspace catalog (5 types with capacity/pricing), booking wizard (dates → entry survey → confirm), My Bookings, Admin Dashboard (utilization, revenue, satisfaction).

### Portal 2 — Business Management (AICoE Admin-facing)
Client onboarding, workspace assignment, onboard interviews, central booking management (alongside self-service). Manages all business attributes related to the AICoE service.

### Portal 3 — Operations & Support
Manages the whole EVA DA Workspaces platform and other RAG-like solutions. Leverages APIM, Azure Analytics, and other Azure OOTB features as the operational backbone. Four ops disciplines must be covered by the design:

- **FinOps** — cost attribution, chargeback, budget monitoring, anomaly detection (41-task WBS: cost model → APIM header instrumentation → Azure cost ingestion → Power BI dashboards → budget alerts)
- **AIOps** — model performance monitoring, RAG quality metrics (groundedness, relevance, coherence), agent tracing, drift detection
- **LiveOps** — service health, incident management, SLA tracking, capacity planning across workspaces/indexes
- **DevOps** — CI/CD pipelines, infrastructure provisioning, deployment management, environment promotion

## UI/UX stack

| Layer | Technology |
|-------|-----------|
| GC mandatory chrome | `@cdssnc/gcds-components-react` — header, footer, nav, language toggle, breadcrumbs, error summary |
| Application components | shadcn/ui + Radix UI — chat, dashboards, dialogs, data tables, admin panels |
| Styling | Tailwind CSS v4 + GC design tokens as CSS variables |
| Charts | Recharts |
| i18n | react-i18next + `{en,fr}.json` — all strings externalized, no hardcoded text |
| a11y | GCDS baseline + axe-core + screen reader testing — WCAG 2.1 AA floor, EN 301 549 target |
| Auth | `@azure/msal-react` — Entra ID SSO |
| Framework | React 19 + Vite 6 + TypeScript 5.7 |

Not Fluent UI — v9 doesn't support React 19, v8 is legacy. GC Design System is the official GoC standard with React wrappers.

## Design principles

Two companion docs in this repo define the full set of design principles:

- **`Agentic-State-Vision.md`** — 10 principles from the Agentic State 12-layer framework (Ilves & Kilian, 2025): forensic audit trail, compliance-as-code, agent identity, escalation tiers, outcome-based FinOps, proactive service, interoperability, security for autonomy, bilingual/accessible.
- **`EVA-Design-Principles-Beyond-Agentic-State.md`** — 9 principles filling practical gaps: confidence scoring & disclosure, explainability & reasoning transparency, temporal validity & source freshness, graceful degradation, multi-agent conflict resolution, feedback loops & continuous improvement, version control & rollback, contextual adaptation beyond language, sandbox & simulation testing.

These are architectural invariants, not Phase 5 bolt-ons. Every answer carries: confidence score, explainability (retrieval path + reasoning + negative evidence), source freshness, behavioral fingerprint (model + prompt + corpus + policy versions), and full provenance chain.

## Reference documents

| Document | Version |
|----------|---------|
| EVA Foundation Technical Design & ConOps | v0.4, March 2025 |
| ESDC AI Reference Architecture (EARB deck) | Approved Jan 29 2025 |
| EVA Foundation Business Case | V1 (Marco Presta) |
| EVA Foundational Requirements Management Matrix | V1 (Ayre, Leach) |

Security frameworks in scope (AIRA Annex 3b): NIST AI RMF, ISO/IEC 42001:2023, OWASP Top 10 for LLM, MITRE ATLAS, Google SAIF.
