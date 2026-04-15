# EVA Agentic (53-EVA-Refactor) — Implementation Plan

## Context

Rebuild EVA Domain Assistant from scratch as EVA Agentic — a governed, multi-step agentic RAG platform on Azure. Aligned to the Agentic State 12-layer framework (Ilves & Kilian, 2025) and ESDC AI Reference Architecture (AIRA).

MSIA (PubSec-Info-Assistant) is **reference for functional requirements only** — what needs to work (upload, chunk, embed, search, chat, cite). The implementation is built agentic-native: every operation observable, explainable, traceable. Answers carry data provenance and correlation. No code is ported from MSIA.

46-accelerator (GitHub Spark PoC) is **reference for Portal 1 UX** — workspace booking, team RBAC, surveys.

Open WebUI (`../open-webui`) is **reference for platform management patterns** — model registry with admin enable/disable, function valves (schema-driven tool config), prompt versioning, evaluation arena (Elo-based model comparison), persistent memories, pluggable RAG backends, artifact storage for stateful agents, content extraction engine abstraction.

**Infrastructure consumed (not built):**
- `../75-EVA-vNext` — **P53's infrastructure chassis.** Provides: APIM public edge (`msub-eva-vnext-apim`), Azure AI Foundry + OpenAI deployments (gpt-5-mini, gpt-5.1), AI Search, Document Intelligence, Service Bus execution bus (`msub-eva-vnext-bus`), VNet with private endpoints, Cosmos DB canonical model, Entra ID + JWT/JWKS auth, OpenTelemetry instrumentation, Application Insights. P53 agents are hosted on this chassis — no parallel infrastructure.
- `../77-FinOps-TK` — **FinOps reference architecture.** 8 phases complete. Cost extraction pipeline (FOCUS 1.2-preview), executive metrics contract, dashboard view model, AOE gate logic, security FinOps bridge. Production surface lives in P75 (`/v1/products/aca/*`). P53 FinOps Command Center consumes P75 APIs, does not rebuild.

**Fixed:** AIRA, ITSG-33, Protected B, WCAG 2.1 AA, bilingual EN/FR, Azure-first (marcusub, Canada Central), APIM-routed, shared trunk.

---

## Design Principles

Two sources: `Agentic-State-Vision.md` (10 principles from the 12-layer framework) and `EVA-Design-Principles-Beyond-Agentic-State.md` (9 principles filling practical gaps). These are architectural invariants from Phase 0, not Phase 5 bolt-ons.

### From Agentic State Vision (framework alignment)

1. **Forensic-grade audit trail** — every agent action logs: subject, actor, delegation chain, purpose, resource accessed, policy decision. OTEL-compatible. Data provenance on every answer.
2. **Compliance-as-code** — TBS/ESDC rules as executable policy at runtime, not documentation.
3. **Agent identity & scoped authority** — each agent/tool gets a distinct identity with ephemeral, auditable permissions. No shared service accounts.
4. **Human escalation tiers** — auto-resolve → flagged-for-review → requires-human-decision. Confidence thresholds, not blanket HITL.
5. **Outcome-based FinOps** — resolution rate, time-to-answer, citation accuracy alongside consumption cost.
6. **Data provenance** — every response correlates to: source documents (with page/section), agent steps that produced it, policy decisions applied, and the delegation chain.
7. **Proactive over reactive** — design for push-based, anticipatory workflows, not just query-response.

### Beyond the Agentic State (practical gaps filled by EVA)

8. **Confidence scoring & disclosure** — every answer carries a computed confidence score (0–1) derived from retrieval relevance, source coverage, grounding quality. Surfaced to user, feeds escalation tiers, logged in audit trail. Must perform equivalently EN/FR. Calibrated over time (predicted confidence vs. actual accuracy).
9. **Explainability & reasoning transparency** — retrieval path visibility (which sources considered, which used, which excluded), structured reasoning summary (not raw chain-of-thought), negative evidence disclosure ("no sources found for X"), two-layer detail (user-facing summary + auditor-facing drill-down). Cross-language retrieval disclosed.
10. **Temporal validity & source freshness** — every document carries last-verified/last-updated date (mandatory index field). Freshness-aware retrieval ranking with configurable decay curves. Staleness disclosure on answers. Corpus health monitoring (alert when index not refreshed past cadence). Supersession detection where feasible.
11. **Graceful degradation** — partial answer with disclosure when components unavailable. Fallback hierarchy: full RAG → partial RAG with disclosure → cached response → "I cannot answer, here's who to contact." No silent hallucination (hard rule). Circuit breakers per dependency. Degraded mode always communicated to user.
12. **Multi-agent conflict resolution** — detect when agents return conflicting answers (semantic comparison). Surface conflict with attribution, don't silently pick one. Arbitration hierarchy: legislation > regulation > policy > guidance. Provenance-based resolution. Conflicts logged for pattern analysis.
13. **Feedback loops & continuous improvement** — correction capture (what was wrong, what's correct, why). Retrieval quality feedback from user signals (accepted/rejected/edited). Confidence calibration loop. Source quality scoring over time. Guardrail refinement from correction patterns. Privacy-safe aggregation (anonymized before influencing behavior).
14. **Version control & rollback for agent behavior** — behavioral fingerprint on every response: model version, prompt version, corpus snapshot date, active policy rules. Change tracking with rationale. A/B testing before rollout. Rollback mechanism. Regression detection against curated test pairs. Audit-ready change log.
15. **Contextual adaptation beyond language** — adaptive complexity (plain language by default, depth on request). Cognitive accessibility beyond WCAG compliance. Channel-appropriate rendering (same answer, different treatment per channel). Indigenous language awareness (don't break on names/terminology, route to human when needed).
16. **Sandbox & simulation testing** — production-like sandbox with mirrored indices/policies/configs. Red-teaming protocol (prompt injection, edge cases, bilingual confusion). Scenario-based regression suites per domain with SME-validated answers. Load and degradation testing. Bias/fairness audits across EN/FR and demographics. Pre-deployment gate (no agent update goes live without passing sandbox).

---

## MSIA OOTB Backend & Ingestion → EVA Agentic Mapping

### Backend API (OOTB → EVA)

| MSIA OOTB endpoint | What it does | EVA Agentic | Enhancement |
|---------------------|-------------|-------------|-------------|
| `POST /chat` (NDJSON stream) | Select approach → generate query → embed → search → stream answer with citations | `POST /chat` via ReAct orchestrator | + agent step events, provenance, confidence, explainability, freshness, behavioral fingerprint. Tools replace hardcoded approach logic. |
| `POST /chat` approach=GPTDirect | Ungrounded chat, no retrieval | Same — direct GPT via APIM | + provenance shows `sources_consulted: 0`. Clearly labeled. |
| `POST /file` (FormData upload) | Upload file to blob storage | `POST /documents/upload` | + ingestion OTEL trace, archetype detection, extraction engine selection |
| `POST /deleteItems` | Soft-delete blob, queue cleanup | `DELETE /documents/:id` | + audit trail entry, provenance of deletion |
| `POST /resubmitItems` | Requeue failed file for reprocessing | `POST /documents/:id/resubmit` | + tracks retry provenance |
| `POST /getalluploadstatus` | Query Cosmos DB for file statuses by timeframe/state/folder/tag | `GET /documents/status` | + OTEL trace link per document, pipeline stage visualization |
| `POST /getfolders` | List folders in upload container | Replaced by workspace scoping | Folders replaced by workspace-scoped storage |
| `POST /gettags` | List unique tags from Cosmos DB | `GET /documents/tags` | Same — tags within workspace |
| `POST /getcitation` | Fetch chunk JSON from blob | `GET /citations/:id` | + provenance of how citation was selected (retrieval score, ranking position) |
| `POST /logstatus` | Log processing status to Cosmos DB | Internal — OTEL spans replace manual status logging | Status derived from trace, not manually logged |
| `GET /getFeatureFlags` | Return boolean feature flags | Replaced by workspace config | Per-workspace feature configuration, not global flags |
| `GET /getInfoData` | Return model deployment info | `GET /system/info` | + model registry info, prompt versions, corpus snapshot dates |
| `GET /getWarningBanner` | Return warning text | `GET /system/notices` | + degradation notices, staleness warnings, compliance alerts |
| `GET /health` | Service health with uptime | `GET /health` | + dependency health (search, cosmos, openai, APIM), degradation tier |
| `POST /get-file` | Download file from blob | `GET /documents/:id/download` | + access control via workspace RBAC |

**Not carried forward:** `/getHint` (math), `/posttd` `/process_td_agent_response` `/getTdAnalysis` `/refresh` `/stream` `/tdstream` `/process_agent_response` `/getTempImages` (tabular data), Bing search approaches (4, 5, 6).

### Backend internals (OOTB → EVA)

| MSIA internal | What it does | EVA Agentic | Enhancement |
|---------------|-------------|-------------|-------------|
| `chatreadretrieveread.py` — query generation | Few-shot LLM call (temp=0) to generate optimized search query from history | `tools/search.py` — query_gen step | + OTEL span, query logged in provenance |
| `chatreadretrieveread.py` — embedding call | REST POST to enrichment service `/models/{model}/embed` | `tools/search.py` — embed step | Via APIM, not direct. Model selectable per workspace from registry. |
| `chatreadretrieveread.py` — hybrid search | `VectorizedQuery` + optional semantic reranker + folder/tag filters | `tools/search.py` — search step | + workspace_id filter, freshness-aware ranking, configurable reranker via valves |
| `chatreadretrieveread.py` — citation SAS | Generate 2-hour SAS URLs for cited source files | `tools/cite.py` | + freshness metadata per citation (last_verified), source quality score |
| `chatreadretrieveread.py` — response generation | System prompt with personas + sources + streaming completion | `agents/orchestrator.py` — answer step | + language-parameterized prompts (i18n), confidence scoring, grounding enforcement, behavioral fingerprint |
| `chatreadretrieveread.py` — language detection & translation | Azure AI Language detect → translate query if needed → translate response if needed | `tools/translate.py` | First-class tool in registry. Cross-language retrieval disclosed in explainability. |
| `approach.py` — token management | `get_messages_from_history()` with backward iteration, tiktoken counting | `core/token_budget.py` | Same functional approach — token-aware message construction |
| `messagebuilder.py` — message accumulation | Append messages tracking total token count | `core/message_builder.py` | Same — accumulate messages within token budget |
| `modelhelper.py` — token limits | Hardcoded token limits per model name | `models/registry.py` | Dynamic from model registry. Limits fetched from Azure OpenAI deployment metadata. |
| `gpt_direct_approach.py` — ungrounded | System prompt + history → streaming completion, no search | `tools/direct_chat.py` | + provenance with `sources_consulted: 0`, confidence scoring (lower by default for ungrounded) |

### Ingestion pipeline (OOTB → EVA)

| MSIA function | Trigger | What it does | EVA Agentic | Enhancement |
|---------------|---------|-------------|-------------|-------------|
| `FileUploadedFunc` | Blob trigger | Route by file extension to queues. Cleanup old chunks. Extract tags. | `handlers/file_uploaded.py` | + OTEL span (root of ingestion trace). Archetype detection (not just extension). Extraction engine selection from config. |
| `FileFormRecSubmissionPDF` | Queue: pdf_submit | Submit PDF to Form Recognizer. Handle 429 throttling with exponential backoff. | `handlers/pdf_extract.py` | + OTEL span. Circuit breaker (Principle 4). Extraction engine abstraction (could be Doc Intelligence, Tika, etc.) |
| `FileFormRecPollingPDF` | Queue: pdf_polling | Poll FR for results. Build document map. Chunk with `build_chunks()`. | `handlers/pdf_extract.py` (combined) | + OTEL span per stage. Document map → provenance artifact. Chunking strategy selected by workspace archetype config. |
| `FileLayoutParsingOther` | Queue: non_pdf_submit | Parse 11+ formats via `unstructured` library. Chunk via `chunk_by_title()`. | `handlers/layout_parse.py` | + OTEL span. Same format support. Extraction engine abstraction. Chunking strategy configurable. |
| `TextEnrichment` | Queue: text_enrichment | Language detect → translate → entity recognition → key phrase extraction. Update chunk blobs. | `handlers/enrich.py` | + OTEL span. Translation disclosed in provenance. Enrichment results traceable. |
| `ImageEnrichment` | Queue: image_enrichment | Computer Vision (caption, objects, tags, OCR) → single chunk → direct index. | `handlers/image_enrich.py` | + OTEL span. Same functional approach. |
| `FileDeletion` | Timer (10min) | Detect soft-deleted blobs → delete chunks → delete index entries → update Cosmos. | `handlers/file_deletion.py` | + Audit trail entry for deletion. Provenance of what was removed. |
| `shared_code/utilities.py` — `build_document_map_pdf()` | Called by polling function | Parse FR `analyzeResult` → structured map with paragraph roles (title/section/text/table), page numbers, table HTML. | `chunking/document_map.py` | Same functional output. + OTEL span. Map stored as provenance artifact (auditable). |
| `shared_code/utilities.py` — `build_chunks()` | Called by polling/layout functions | Token-based chunking (cl100k_base). Section-aware splitting. Table header preservation across pages. Sentence-boundary fallback for oversized paragraphs. | `chunking/default.py` | Reimplemented with same algorithm. + Archetype-configurable: legislation chunker respects hierarchical structure, case law chunker preserves citation boundaries. Strategy selected per workspace. |
| `shared_code/utilities.py` — `table_to_html()` | Called by build_document_map | Convert FR table JSON → HTML with header detection, rowSpan/colSpan support. | `chunking/table_parser.py` | Same. |
| `shared_code/utilities.py` — `chunk_table_with_headers()` | Called by build_chunks | Split large HTML tables preserving headers across chunks. Track multi-page table headers. | `chunking/table_parser.py` | Same. |
| `shared_code/status_log.py` — StatusLog class | All functions | Cosmos DB status tracking: upsert document, append status_updates[], track state machine (UPLOADED→PROCESSING→INDEXING→COMPLETE\|ERROR). | `shared/status.py` | Status derived from OTEL traces, not manual logging. Cosmos DB still stores state but enriched with trace_id links. Status updates are OTEL events, not manual appends. |
| Enrichment service — queue polling | Background thread, 5s interval | Dequeue from embeddings_queue → read chunk blobs → call `/models/{model}/embed` → batch upload to AI Search index (200/batch) → update Cosmos status. | Collapsed into pipeline | Embedding is a pipeline step, not a separate polling service. Called directly via APIM-routed Azure OpenAI embeddings endpoint. Batch indexing to AI Search preserved. |
| Enrichment service — `/models/{model}/embed` | REST API | Load HuggingFace sentence-transformers or Azure OpenAI embedding model. Return vector. | Via APIM to Azure OpenAI | No separate embedding service. Azure OpenAI embeddings via APIM for audit trail + FinOps headers. Model selectable per workspace from registry. |

### Retry & resilience (OOTB → EVA)

| MSIA pattern | How it works | EVA Agentic |
|--------------|-------------|-------------|
| Queue requeue with counters | `submit_queued_count`, `polling_queue_count`, `text_enrichment_queued_count` increment on retry. Max counts configurable. Exponential backoff (quadratic). | Same functional pattern but wrapped in circuit breaker (Principle 4). Retry counts and backoff in OTEL spans. After max retries → graceful degradation notice, not silent failure. |
| FR polling with backoff | Poll every `POLLING_BACKOFF × count² + random(0,10)` seconds. Max `MAX_POLLING_REQUEUE_COUNT` attempts. | Same. + OTEL span per poll attempt. |
| 429 throttle handling | Catch 429, requeue with exponential backoff | Same. + Circuit breaker state tracked. APIM rate limits as first defense. |
| Enrichment retry | `@retry(stop=stop_after_attempt(5), wait=wait_fixed(1))` on blob reads | Same tenacity pattern. + OTEL span per retry. |

### What MSIA backend DOESN'T have (EVA adds)

| Capability | Why it matters |
|------------|---------------|
| **Provenance on every response** | MSIA returns answer + citations. EVA returns answer + citations + full provenance chain (correlation_id, delegation_chain, sources consulted/cited/excluded, policies applied, confidence, freshness, behavioral fingerprint, trace_id). |
| **Confidence scoring** | MSIA has no confidence signal. EVA computes confidence from retrieval relevance, source coverage, grounding quality. Feeds escalation tiers. |
| **Explainability** | MSIA has "thought process" (raw HTML dump of search terms). EVA has structured explainability: retrieval path, reasoning summary, negative evidence, cross-language disclosure. |
| **Source freshness** | MSIA has no freshness awareness. EVA tracks last_verified per document, applies decay curves in ranking, discloses staleness. |
| **Graceful degradation** | MSIA fails with HTTP 500 or hangs. EVA has fallback hierarchy (full RAG → partial RAG with disclosure → cached → "I cannot answer") with circuit breakers. |
| **OTEL tracing** | MSIA has Application Insights (basic). EVA has distributed OTEL traces: every tool call, every pipeline stage, every Azure service call is a span. |
| **Archetype-configurable chunking** | MSIA has one chunking strategy (token-based with section awareness). EVA has pluggable strategies: default, legislation (hierarchical), case law (citation-aware). Selected per workspace. |
| **Pluggable extraction engines** | MSIA hardcodes Form Recognizer for PDF, unstructured for non-PDF. EVA abstracts behind factory pattern — OpsSup configures which engine per document type. |
| **Model registry** | MSIA hardcodes one model deployment. EVA has a registry: enable/disable models, parameter overrides, per-workspace assignment, Elo-based evaluation. |
| **Prompt versioning** | MSIA has hardcoded prompt templates. EVA versions every prompt change with author, timestamp, diff, rollback. |
| **Feedback loops** | MSIA has no feedback mechanism. EVA captures corrections, calibrates confidence, scores source quality. |
| **Multi-workspace scoping** | MSIA has one index. EVA has per-workspace indexes with workspace_id filtering. |
| **APIM cost attribution** | MSIA calls Azure OpenAI directly. EVA routes through APIM with FinOps + outcome headers on every call. |
| **Compliance-as-code** | MSIA has no policy engine. EVA has executable TBS/ESDC rules evaluated per request. |
| **Escalation tiers** | MSIA has no escalation. EVA has auto-resolve → flagged-for-review → requires-human-decision based on confidence. |

---

## Resolved Architecture Decisions

### 1. Orchestration: Azure AI Agent Service (Foundry-managed)

The ReAct orchestrator runs on **Azure AI Agent Service** via Foundry. Not Semantic Kernel, not custom Python.

**Why:** Foundry-managed means AIS infra team owns the runtime operationally. AICoE dev owns agent definitions, tool registry, and prompt logic. Prompt Flow enables non-dev governance stakeholders to review and modify prompt logic without touching code. Foundry tracing gives OTEL-compatible per-run observability. Safety evaluations and red-teaming are built in. This is the runtime the AIRA architecture prescribes.

**Implications:**
- Tools registered via Foundry tool schema (not arbitrary Python functions)
- Agent definitions stored in Foundry Project, versioned
- Prompt Flow for agent chain authoring — visual review by governance
- Connections hub for Azure OpenAI, AI Search, Blob — single key rotation point
- Evaluation framework feeds AICM quality measurement
- Tracing supplements Azure Log Analytics

### 2. Auth: Demo-mode user plane with proforma login

Production auth is ESDC Entra ID SSO — details TBD by ESDC. For development and demos, EVA Agentic uses a **demo-mode user management plane** that simulates the full auth flow:

**Demo-mode login:**
- Login page shows a dropdown of pre-configured user emails + persona selector
- Selecting a user + persona sets all downstream attributes: `user_id`, `user_email`, `user_group`, `role` (reader/contributor/admin), `portal_access` (self-service/admin/ops), `workspace_grants[]`, `data_classification_level`
- No real authentication — selecting a user is the login
- Behind the scenes, the API gateway reads these from a `demo_users` config (Cosmos DB or JSON file)
- All APIM headers (`x-app-id`, `x-user-group`, `x-classification`) are populated from the selected persona
- RBAC enforcement works identically to production — the demo user plane just provides the identity claims differently

**Persona definitions (pre-configured):**

| Email | Name | Persona | Portal | Workspaces | Role |
|-------|------|---------|--------|-----------|------|
| alice@demo.gc.ca | Alice Chen | Self-service user | P1 | OAS Act, EI Jurisprudence | contributor |
| bob@demo.gc.ca | Bob Wilson | Self-service reader | P1 | OAS Act | reader |
| carol@demo.gc.ca | Carol Martinez | AICoE Admin | P2 | All (admin) | admin |
| dave@demo.gc.ca | Dave Thompson | Ops & Support | P3 | All (ops) | admin |
| eve@demo.gc.ca | Eve Tremblay | Multi-workspace user | P1 | OAS Act, EI Jurisprudence, BDM KM | contributor |

**Switchover to production:**
- Environment variable: `AUTH_MODE=demo|production`
- `demo`: user plane login, no real tokens
- `production`: Entra ID SSO via MSAL, APIM JWT validation, real Entra ID group claims
- The API gateway auth middleware reads the same interface (`UserContext`) regardless of mode — only the provider changes
- Demo mode disabled in production by config, not by code removal

**Key files:**
- `services/api-gateway/app/auth/demo_provider.py` — reads demo_users config, returns UserContext
- `services/api-gateway/app/auth/entra_provider.py` — validates JWT, extracts claims, returns UserContext
- `services/api-gateway/app/auth/middleware.py` — selects provider based on AUTH_MODE
- `services/api-gateway/app/auth/models.py` — UserContext (user_id, email, role, groups, workspace_grants, classification)
- `apps/portal-self-service/src/pages/DemoLogin.tsx` — dropdown login (demo mode only)
- `packages/eva-ui-kit/src/hooks/use-auth.ts` — abstracts demo vs MSAL auth

### 3. Multi-index architecture & workspace allocation

**Design: one AI Search service, N indexes, workspace-scoped access**

MSIA has 1 index. EVA DA has 50 (selected via dropdown, filtered by RBAC). EVA Agentic formalizes this:

```
AI Search Service (single instance)
├── eva-workspace-{workspace_id}-index    # Per-workspace content index
│   Fields: id, content, contentVector, file_name, title, section, pages,
│           chunk_file, file_uri, entities, key_phrases, ingestion_trace_id,
│           uploaded_by, processed_datetime, tags[], freshness_date
├── eva-workspace-{workspace_id}-index    # Another workspace
├── ...
└── eva-memories-index                     # Cross-workspace user memories
    Fields: id, user_id, content, embedding, workspace_id, created_at
```

**Workspace ↔ Index lifecycle:**

| Event | What happens to the index |
|-------|--------------------------|
| Admin creates workspace type | No index yet — workspace type is a template |
| Admin assigns workspace to client | No index yet — assignment is a capability grant |
| Client books workspace | **Index created**: `eva-workspace-{booking_id}-index` with schema from workspace archetype config. Chunking strategy, embedding model, reranker config set from workspace type. |
| Client uploads documents | Documents processed through pipeline → chunks indexed into workspace's index |
| Client chats | Search scoped to `eva-workspace-{booking_id}-index`. User sees only their workspace. |
| Booking completed/cancelled | Index **retained** for audit trail (configurable retention: 7-365 days). Read-only after completion. |
| Retention expired | Index **deleted**. Blob chunks deleted. Audit record preserved in Cosmos. |

**Workspace selector (Portal 1 chat page):**
- Dropdown in chat header shows user's active workspaces (from their bookings where `status=active`)
- Values filtered by user's `workspace_grants[]` from auth context
- Selecting a workspace sets the `workspace_id` for all subsequent chat queries
- Search tool filters by workspace's index name
- Upload target determined by selected workspace

**RBAC enforcement at index level:**

| Role | Can search | Can upload | Can delete docs | Can manage index |
|------|-----------|-----------|----------------|-----------------|
| Reader | Yes (query only) | No | No | No |
| Contributor | Yes | Yes | Own uploads only | No |
| Admin | Yes | Yes | Any | Yes (via Portal 2) |

**Implementation:**
- Each workspace index is created programmatically via AI Search Management API when booking is approved
- Index schema generated from workspace type's archetype config (which chunking strategy, which fields to index, vector dimensions based on selected embedding model)
- Workspace-to-user mapping stored in Cosmos DB (`workspace_grants` on booking + team members)
- API gateway checks `user.workspace_grants` before allowing any search/upload/delete operation on a workspace index
- APIM header `x-workspace-id` set on every request for FinOps cost attribution

### 4. APIM rate limiting

| Scope | Limit | Policy |
|-------|-------|--------|
| Per user | 60 requests/minute to chat, 120 requests/minute to other APIs | `rate-limit-by-key` keyed on `x-user-id` header |
| Per workspace | 300 requests/minute across all users | `rate-limit-by-key` keyed on `x-workspace-id` |
| Per client org | 1000 requests/minute across all workspaces | `rate-limit-by-key` keyed on `x-user-group` |
| Azure OpenAI backend | Governed by deployment TPM/RPM limits | APIM `retry` policy with exponential backoff to secondary deployment |

---

## Chat experience architecture

### Two chat contexts, different scoping:

**EVA DA RAG Chat (workspace-scoped):**
- Chat within a booked workspace
- Search scoped to workspace's AI Search index
- Documents from workspace's blob container
- Agent has access to workspace's tool configuration (valves)
- Conversation history per user per workspace (Cosmos DB)
- **File attachment in chat**: user can attach a file inline → uploaded to workspace, processed through pipeline, available for RAG in the same conversation once indexed. Status indicator shows processing progress inline.

**EVA Chat (user-scoped, general):**
- General assistant chat, not tied to a workspace
- Ungrounded (direct GPT) by default
- Can optionally search across workspaces the user has access to (multi-index search)
- Conversation history per user (Cosmos DB)
- **File attachment in chat**: user can attach a file inline → temporary processing (not persisted to any workspace index). Extracted text included in conversation context for that session only. Ephemeral.

### Chat UI enhancements over MSIA OOTB:

| Feature | MSIA OOTB | EVA Agentic |
|---------|-----------|-------------|
| Workspace selector | None (single index) | Dropdown of user's active workspaces, filtered by RBAC |
| File attachment in chat | None | Inline file attach → upload to workspace (RAG) or ephemeral processing (Chat) |
| Agent step visibility | None (hidden "thought process" HTML) | Real-time agent step trace (collapsible, animated, accessible) |
| Confidence indicator | None | Badge with score + color (green/amber/red) |
| Freshness warnings | None | Per-citation staleness disclosure |
| Explainability | Raw HTML thought dump | Structured: retrieval path, reasoning summary, negative evidence |
| Provenance | None | Full provenance object on every response |
| Feedback | None | Thumbs up/down + correction capture |
| Degradation notice | None (500 error) | Banner: "Partial results — [service] unavailable" |
| Cross-language disclosure | None | "Answer based on English sources; translated from French query" |
| Follow-up suggestions | Extracted from `<<<>>>` markers | Same mechanism, styled as suggestion chips |
| Conversation memory | None | Per-user semantic memory (persists across conversations within workspace) |
| Streaming quality | Character-by-character jerky | Smooth word-group type-on with Framer Motion |

### File attachment flow:

**In workspace RAG chat:**
```
User attaches file in chat input
  → File uploaded to workspace blob container
  → Pipeline triggered: extract → chunk → enrich → embed → index
  → Chat input shows inline processing status (uploading → processing → ready)
  → Once indexed, user's question searched against workspace index (including new file)
  → Response cites new file if relevant
```

**In general Chat (ephemeral):**
```
User attaches file in chat input
  → File extracted (Document Intelligence or Tika, based on type)
  → Extracted text injected into conversation context (system message)
  → Not persisted to any index
  → Available for this conversation only
  → Provenance shows "ephemeral attachment, not indexed"
```

---

### File type ingestion improvements (MSIA gaps → EVA fixes)

| File type | MSIA handling | Problem | EVA Agentic approach |
|-----------|--------------|---------|---------------------|
| **JSON** | `partition_text()` — treated as raw text | Loses structure. Key-value pairs, arrays, nested objects become flat text. No schema awareness. | Structure-aware JSON parser: extract keys as metadata, preserve hierarchy in chunks. Schema detection for known formats (FHIR, GeoJSON, etc.). |
| **XML** | `partition_xml()` — treated as text | Same problem. Loses element hierarchy, attributes, namespaces. MS Project XML (.mpp export) unreadable. | Structure-aware XML parser: extract element paths as section headers, attributes as metadata. **MS Project XML**: extract tasks, dependencies, milestones, resources as structured data — not flat text. |
| **PDF** | Form Recognizer `prebuilt-layout` → HTML tables + text paragraphs | Adequate for simple PDFs. Complex layouts (multi-column, embedded charts, watermarks) degrade. Mathematical formulas lost. | **PDF-to-LaTeX** (e.g., Nougat, Marker) for formula-heavy documents. Form Recognizer as default. Extraction engine selected per document type config (Principle: pluggable extraction). |
| **Excel (.xlsx)** | `partition_xlsx()` from unstructured | Treats sheets as flat text. Loses formulas, named ranges, pivot table structure, cross-sheet references. | Sheet-aware parser: each sheet is a section. Preserve column headers as metadata. Detect data tables vs. narrative cells. Formula references preserved as relationships. Named ranges as semantic anchors. |
| **MS Project (.mpp / .xml)** | Not supported (MSIA ignores .mpp, treats .xml as generic) | Project plans are structured data: tasks, dependencies, milestones, resources, timelines. Flat text parsing destroys all of this. | Dedicated MS Project parser: extract task hierarchy (WBS), dependencies (predecessor/successor), milestones, resource assignments, timeline. Chunk by work package or phase. Metadata: task ID, % complete, critical path flag. |
| **CSV** | `partition_csv()` — treats as text | Loses column headers, row relationships. Large CSVs become meaningless text blobs. | Column-aware CSV parser: headers as metadata, chunk by row groups preserving headers. Schema detection. Summary statistics as enrichment metadata (row count, column types, value ranges). |

**Extraction engine config (Portal 3 — OpsSup):** For each file type, OpsSup configures:
- Which extraction engine to use (Document Intelligence, Tika, custom parser, PDF-to-LaTeX)
- Chunking strategy override (if different from workspace default)
- Metadata extraction rules (what fields to elevate to index metadata)

**Not carried forward:** Bing web search, math assistant, tabular data assistant, compare-work-with-web modes, media submit queue (no processing function exists in MSIA either).

---

## Features Adopted from Open WebUI (adapted for Azure-first, APIM-routed)

| Feature | Open WebUI pattern | EVA Agentic adaptation | Phase |
|---------|-------------------|----------------------|-------|
| **Model Registry** | Admin enable/disable models, parameter overrides, per-user/group access | OpsSup controls which Azure OpenAI models are available per workspace. GPT-4o for Jurisprudence, GPT-4o-mini for FAQ. All through APIM. | P1 (registry), P3 (admin config), P4 (OpsSup dashboard) |
| **Function Valves** | Schema-driven dynamic UI for tool configuration | BusAdmin/OpsSup tunes search params (top-k, reranker threshold), chunking settings, translation prefs per workspace — no code changes | P3 |
| **Prompt Versioning** | Full version history with rollback | Every system prompt change versioned and auditable. Regression → trace to prompt change → rollback. Compliance-as-code artifact. | P1 (schema), P3 (admin UI) |
| **Evaluation Arena** | Elo-based model comparison via user feedback | Users compare model responses per archetype. Feeds AIOps: which model performs best for legislation vs. case law vs. dashboards. | P4 |
| **Persistent Memories** | Semantic memory across conversations, stored as embeddings | Agent remembers user context (role, past queries, preferences). Per-user memory collection in AI Search vector index. | P2 |
| **Pluggable RAG Backend** | Factory pattern for vector DB, reranker, embeddings | Abstract embedding model, reranker, extraction engine behind interfaces. Different workspaces can use different strategies per archetype. | P1 (interfaces), P3 (workspace config) |
| **Artifact Storage** | KV store for stateful agent interactions | Agents maintain state across sessions — drill-down history (Equi'Vision), case evaluation progress (GovOps), conversation bookmarks. | P2 |
| **Content Extraction Abstraction** | Tika, Docling, Azure Doc Intelligence, Mistral OCR behind pluggable interface | Doc pipeline supports multiple extraction engines. OpsSup configures per document type — not hardcoded to Document Intelligence. | P1 (interface), P4 (OpsSup config) |

---

---

## MSIA OOTB UI → EVA Agentic Mapping

MSIA provides a functional RAG UI out of the box. Every OOTB feature maps to EVA Agentic requirements — reimplemented in GC Design System identity, enhanced with agentic capabilities, and elevated with AI-inspired interactions and motion design on the customer-facing portal. All three portals follow GC identity. Portal 1 gets the magic.

### OOTB Features That Carry Forward (reimplemented, not ported)

| MSIA OOTB | Screen | EVA Agentic equivalent | Portal | Enhancement |
|-----------|--------|----------------------|--------|-------------|
| **Chat with streaming** | Chat.tsx | ChatPage.tsx | P1 | + agent step trace, provenance badge, confidence indicator, explainability panel |
| **Citation superscripts** | Answer.tsx + AnswerParser.tsx | Answer component | P1 | + freshness badge per citation, source quality indicator, cross-language disclosure |
| **Citation viewer** | AnalysisPanel.tsx (3 tabs) | CitationViewer + ExplainabilityPanel | P1 | + provenance drill-down, negative evidence tab, retrieval path visualization |
| **Thought process tab** | AnalysisPanel "Thought Process" | ExplainabilityPanel "Reasoning" tab | P1 | + structured reasoning summary (not raw HTML), delegation chain visualization |
| **Supporting content tab** | AnalysisPanel "Supporting Content" | ExplainabilityPanel "Sources" tab | P1 | + sources considered vs used vs excluded, relevance scores, freshness dates |
| **Document preview** | AnalysisPanel Citation tab | CitationViewer | P1 | + page highlighting, section anchoring |
| **Question input** | QuestionInput.tsx | ChatInput component | P1 | + suggested follow-ups from agent, feedback buttons (accept/reject/correct) |
| **Character streaming** | CharacterStreamer.tsx (NDJSON) | useNdjsonStream hook | P1 | + agent step events interleaved, provenance events |
| **Chat mode toggle** | ChatModeButtonGroup (Work/Web/Ungrounded) | ChatModeToggle (Grounded/Ungrounded) | P1 | Drop web mode (Protected B). Add workspace-scoped mode. |
| **Response settings** | SettingsButton → length/temp/personas/top-k | ChatSettings panel | P1 | + function valves (schema-driven, per-workspace defaults from admin config) |
| **Folder filtering** | FolderPicker (multi-select) | Workspace scope (implicit) | P1 | Replaced by workspace scoping — user's active booking determines search scope |
| **Tag filtering** | TagPicker (multi-select) | TagFilter component | P1 | Preserved — tags within a workspace |
| **File upload** | Content.tsx → FilePicker → DropZone | DocumentUpload page | P1 | + ingestion trace (OTEL spans per stage), archetype-aware processing |
| **Upload status tracking** | FileStatus.tsx → DocumentsDetailList | DocumentStatus component | P1 | + OTEL trace link per document, provenance of ingestion chain |
| **File type detection** | FilePicker supported types list | Same — PDF, DOCX, XLSX, CSV, etc. | P1 | + extraction engine indicator (which engine processed this file) |
| **Clear chat** | ClearChatButton | ClearChat action | P1 | Same |
| **Empty state examples** | ExampleList.tsx | ExampleQuestions | P1 | + workspace-specific examples (configured by admin) |
| **Feature flags** | getFeatureFlags() → conditional nav | Feature flags via workspace config | P1-P3 | Per-workspace feature toggles, not global server flags |
| **Warning banner** | WarningBanner.tsx | SystemNotice component | P1-P3 | + degradation notices (Principle 4), staleness warnings |
| **RAI panel** | RAIPanel.tsx (Adjust/Regenerate/Compare) | ResponseActions component | P1 | + feedback capture (accept/reject/correct), no Compare (no web mode) |

### OOTB Features NOT Carried Forward

| MSIA OOTB | Why dropped |
|-----------|------------|
| Web search mode (Work + Web) | Protected B — no external web search |
| Compare Work with Web / Web with Work | No web mode |
| Math Assistant (Tutor) | Out of scope — different solution space |
| Tabular Data Assistant | Out of scope — Equi'Vision is a future solution space |
| Bing search integration | Protected B |
| Fluent UI components | Replaced by GC Design System + shadcn/Radix |

### Entirely New UI (not in MSIA)

| Screen | Portal | What it does |
|--------|--------|-------------|
| **WorkspaceCatalog** | P1 | Browse/filter workspace types with capacity, pricing, features |
| **BookingDialog** | P1 | 2-step wizard: dates + cost → entry survey |
| **MyBookings** | P1 | Active/completed bookings with status, cost, actions |
| **TeamManagement** | P1 | Add/remove members with Reader/Contributor/Admin roles |
| **ExitSurvey** | P1 | Outcomes + cost recovery form |
| **AgentStepTrace** | P1 | Collapsible timeline of agent tool invocations (accessible) |
| **ProvenanceBadge** | P1 | Confidence + sources + freshness at a glance |
| **FeedbackCapture** | P1 | Accept/reject/correct with structured metadata |
| **ClientOnboarding** | P2 | Multi-step client creation wizard |
| **OnboardInterview** | P2 | Structured intake with archetype recommendation |
| **WorkspaceAssignment** | P2 | Assign + configure workspace for client |
| **ModelRegistry** | P2 | Enable/disable models, parameter overrides, access grants |
| **PromptVersioning** | P2 | Version history, diffs, rollback |
| **FunctionValves** | P2 | Schema-driven tool/pipeline config per workspace |
| **BookingApproval** | P2 | Queue of pending bookings to approve/reject |
| **ClientDashboard** | P2 | Per-client usage, cost, satisfaction metrics |
| **FinOpsDashboard** | P3 | Cost by client/workspace/model + outcome metrics + budget alerts |
| **AgentTraceExplorer** | P3 | Full OTEL trace for any conversation |
| **EvaluationArena** | P3 | Elo-based model comparison per archetype |
| **ServiceHealthGrid** | P3 | Service status, queue depths, error rates, alerts |
| **CorpusHealth** | P3 | Index freshness, document counts, staleness alerts |
| **ConfidenceCalibration** | P3 | Predicted vs actual accuracy per model/archetype |
| **SourceQuality** | P3 | Per-corpus acceptance/correction rates |
| **FeedbackAnalytics** | P3 | Correction patterns, guardrail gaps, retrieval trends |
| **ExtractionEngineConfig** | P3 | Map document types to extraction engines |
| **DeploymentHistory** | P3 | CI/CD status, environment gates |

---

## UI/UX Stack

**Decision: GC Design System (mandatory chrome) + shadcn/Radix UI (application components) + Tailwind CSS + GC design tokens**

| Layer | Technology | Purpose |
|-------|-----------|---------|
| GC mandatory chrome | `@cdssnc/gcds-components-react` | Header, footer, navigation, language toggle, breadcrumbs, error summary — required by GC digital standards |
| Application components | shadcn/ui + Radix UI primitives | Chat, dashboards, dialogs, data tables, admin panels — unstyled accessible primitives styled with GC tokens |
| Styling | Tailwind CSS v4 + GC design tokens as CSS variables | Spacing, colors, typography from GC Design System, not hardcoded |
| Charts/visualization | Recharts | Dashboard KPIs, utilization bars, cost charts |
| Motion & animation | Framer Motion | AI-inspired interactions (P1), smooth transitions (P2/P3). Respects `prefers-reduced-motion`. |
| i18n | react-i18next + JSON resource files (`en.json`, `fr.json`) | All strings externalized. Language toggle via GCDS component. No hardcoded strings. |
| a11y | GCDS baseline + axe-core automated + manual screen reader testing | WCAG 2.1 AA floor, EN 301 549 target. `aria-live` for agent steps. Keyboard nav 100%. |
| Auth | MSAL React (`@azure/msal-react`) | Entra ID SSO, JWT tokens, user claims |
| Framework | React 19 + Vite 6 + TypeScript 5.7 | SPA per portal, shared packages |

**Why not Fluent UI?** Fluent UI v9 doesn't officially support React 19. v8 is legacy. MSIA uses v8 with React 18 — we're not porting code. GC Design System is the official GoC standard and has React wrappers. shadcn/Radix gives us unstyled accessible primitives that we style with GC tokens — no design system conflict.

**GC identity is the whole platform — not just Portal 1.** All three portals follow the GC Design System identity: header, footer, navigation, language toggle, typography, color palette, spacing. Admin and Ops portals look like Government of Canada applications, not generic enterprise dashboards.

### Motion & interaction design (Portal 1 — make it magic)

The customer-facing portal should feel intelligent and alive. Motion communicates that there's an agent reasoning, not a database returning rows. Every animation serves a purpose: build trust, show progress, invite exploration.

**Motion framework:** Framer Motion (React 19 compatible, spring physics, layout animations). All animations respect `prefers-reduced-motion` — reduced to opacity-only for a11y. Motion is decorative, never blocks interaction.

| Interaction | Motion | Why |
|-------------|--------|-----|
| Agent thinking | Pulsing orbital animation (subtle, GC-branded) | Shows system is reasoning, not frozen. Distinct from a spinner. |
| Agent step trace | Steps slide in sequentially with staggered fade. Icon morphs: gray → active → checkmark | Reasoning chain feels alive — user sees the agent "working through" it |
| Streaming answer | Smooth word-group type-on (not jerky per-character) | Feels like the agent is speaking, not dumping text |
| Citation appearance | Brief glow-pulse when first referenced in text, then settles | Draws attention to sources without interrupting reading |
| Provenance badge | Confidence ring fills 0→score with easing, color transitions (green/amber/red) | Instant visual read on quality. Animated fill builds anticipation |
| Freshness warning | Slides down from citation with amber fade-in, clock icon animation | Noticeable but not alarming — informational, not error |
| Degradation notice | Top banner slides down with gentle bounce, partial-service icon | Honest about limitations without panic |
| Explainability expand | Panel opens with spring physics, content fades in staggered | Progressive disclosure — invites exploration |
| Workspace card hover | Subtle lift (-2px) + shadow expansion + feature tag shimmer | Cards feel interactive and alive |
| Booking wizard steps | Flowing line animation connecting step nodes | Progress feels continuous, not discrete |
| Document upload | Drop zone pulses on drag-over, file cards slide in, progress bar gradient sweep | Upload feels responsive and satisfying |
| Processing pipeline | Stage icons animate through pipeline with connecting flow line | User sees document moving through the system |
| Language toggle | Content cross-fades (300ms), no hard swap | Seamless, not disruptive |
| Chat messages | User message slides up from input, assistant fades in from left | Natural conversational exchange |
| Feedback capture | Thumbs scale-bounce on click, correction panel slides in | Effortless and acknowledged |
| Error states | Gentle shake + red border fade-in (not jarring alert boxes) | Noticed without causing anxiety |

### Motion in Portal 2 & 3 (professional, restrained)

Admin and Ops portals prioritize information density and speed. Motion is minimal:
- Smooth page transitions (opacity + translateY, 200ms)
- Subtle hover states on interactive elements
- Data loading skeletons (shimmer, not spinners)
- Chart/metric animations on data load (count-up, bar fill)
- No orbital animations, no glowing citations, no spring physics

### i18n architecture (no hardcoded strings)

- All UI strings in `packages/eva-common/src/i18n/{en,fr}.json`
- `useTranslation()` hook from react-i18next in every component
- Language toggle in GCDS header switches locale — content cross-fades, no hard swap
- URL structure: `/{lang}/path` (e.g., `/en/workspaces`, `/fr/espaces-travail`)
- System prompts parameterized by `{lang}` — agent responses match user's language
- Agent step labels bilingual in NDJSON stream (`label_en`, `label_fr`)
- Error messages, form labels, ARIA labels, motion labels — all from i18n files
- Motion labels (e.g., "Searching documents..." / "Recherche de documents...") are i18n strings, never hardcoded

---

## Three Portals — Data, User Stories, Storyboards

### Portal 1 — Self-Service (customer-facing)

**Users:** Business clients (AICoE Business Administrators and their teams)

**Data model:**
```
Workspace {id, name, type, description, features[], capacity, pricing, archetype_config, model_config, escalation_tier, is_active}
Booking {id, workspace_id, client_id, user_id, status (pending|active|completed|cancelled), start_date, end_date, total_cost, search_index_id}
TeamMember {id, booking_id, user_id, name, email, role (reader|contributor|admin), added_at}
EntrySurvey {id, booking_id, use_case, expected_benefits, target_metrics, document_types[], ai_features[], team_size, data_classification}
ExitSurvey {id, booking_id, actual_results, goals_achieved (yes|partial|no), lessons_learned, blockers, suggestions, rating, department, cost_center, approver_name, approver_email}
Document {id, workspace_id, file_name, file_uri, status (uploaded|processing|indexing|complete|error), uploaded_by, uploaded_at, ingestion_trace_id}
ChatMessage {id, conversation_id, workspace_id, role (user|assistant), content, citations[], provenance, created_at}
Memory {id, user_id, workspace_id, content, embedding_vector, created_at}
Artifact {id, user_id, workspace_id, key, value, scope (personal|shared), updated_at}
```

**User stories:**

| ID | Story | Acceptance |
|----|-------|-----------|
| SS-01 | As a client, I browse available workspace types so I can choose the right environment for my data | Catalog page shows workspace cards with name, description, features, capacity, pricing. Filterable. |
| SS-02 | As a client, I book a workspace by selecting dates and completing an entry survey | 2-step wizard: dates + cost preview → entry survey (use case, expected benefits, data classification, team size). Booking created with status "pending". |
| SS-03 | As a client, I manage my team's access to my booked workspace | Add/remove members with Reader/Contributor/Admin roles. Role descriptions visible. Changes enforced immediately at AI Search and Blob Storage level. |
| SS-04 | As a contributor, I upload documents to my workspace and track processing status | Drag-drop upload. Status tracker shows: uploaded → processing → indexing → complete. Error states with retry. |
| SS-05 | As a user, I chat with my workspace's knowledge base and get cited answers | Chat page scoped to workspace index. Streaming responses with agent step trace. Citations link to source documents with page numbers. Provenance badge shows confidence, sources consulted/cited. |
| SS-06 | As a user, I see the agent's reasoning and can drill into how it reached its answer | Collapsible explainability panel: retrieval path (sources considered/used/excluded), reasoning summary, negative evidence. Auditor drill-down available. |
| SS-07 | As a user, I see confidence level and freshness warnings on answers | Confidence badge (high/medium/low). Staleness warning if sources older than threshold. Degradation notice if components unavailable. |
| SS-08 | As a client, I complete an exit survey when my booking ends to capture outcomes and cost recovery | Exit survey: results, goals achieved, lessons, blockers, rating. Cost recovery: department, cost center, approver. Booking marked "completed". |
| SS-09 | As a user, I switch between English and French at any time | Language toggle in header. All UI, form labels, error messages, agent responses switch. No page reload required. |
| SS-10 | As a user, I provide feedback on agent answers (accept/reject/correct) | Thumbs up/down + optional correction text. Captured for feedback loop. |

**Storyboard (golden path):**
```
1. Sign in (Entra ID SSO) → GCDS header with language toggle
2. Workspace Catalog → browse cards → click "Book Workspace"
3. Booking Dialog → Step 1: dates + cost preview → Step 2: entry survey → Confirm
4. My Bookings → new booking card (status: pending → active)
5. Click booking → Workspace view: [Chat] [Documents] [Team] tabs
6. Documents tab → drag-drop upload → status tracker → "Complete"
7. Chat tab → ask question → streaming answer with agent steps → citations → provenance badge
8. Click citation → document viewer with highlighted section
9. Expand explainability → see retrieval path + reasoning
10. Team tab → add contributor → they can upload; add reader → view only
11. Exit survey → outcomes + cost recovery → booking completed
```

---

### Portal 2 — Business Administration (AICoE admin-facing)

**Users:** AICoE administrators who onboard clients, assign workspaces, and manage the platform's client base

**Key design shift from P52:** Today, EVA DA's 50 indexes are hardcoded (`proj1-index` through `proj50-index`) with coupled Azure resources (upload container, content container, AI Search index) that require manual expert intervention to provision or decommission. Project 52 designed a CLI + plugin to fix this. EVA Agentic absorbs P52's intent and goes further — BusAdmin team provisions and manages workspace infrastructure through configuration panels that drive IaC behind the scenes.

**Data model (extends Portal 1):**
```
Client {id, org_name, entra_group_id, billing_contact, data_classification_level, onboarded_at, status (active|suspended|offboarded)}
Interview {id, client_id, admin_id, use_case_description, data_sources[], expected_volume, compliance_requirements, aicm_assessment, archetype_recommendation, created_at}
WorkspaceAssignment {id, client_id, workspace_id, capacity_limit, model_config_override, escalation_tier, chunking_strategy, valves_config{}, assigned_at}
PromptVersion {id, prompt_name, version, content, author, rationale, created_at, is_active}
ModelConfig {id, model_name, provider, deployment_name, capabilities[], classification_ceiling, parameter_overrides{}, is_active, access_grants[]}

# P52-inspired: workspace resource registry (replaces hardcoded GroupResourceMap)
WorkspaceResources {
  id, workspace_id, 
  upload_container_name, content_container_name, search_index_name,
  entra_group_id, role_assignments[],
  provisioning_status (pending|provisioning|ready|decommissioning|archived|error),
  provisioned_at, decommissioned_at,
  iac_run_id  # Link to the IaC execution that created/destroyed resources
}

# P52-inspired: space configuration snapshot (export/import)
WorkspaceSnapshot {id, workspace_id, snapshot_date, config{}, member_upns[], document_count, index_doc_count, created_by}
```

**User stories:**

| ID | Story | Acceptance |
|----|-------|-----------|
| BA-01 | As an admin, I onboard a new client organization with Entra ID group and billing contact | Multi-step onboarding wizard: org details → Entra ID group mapping → billing contact → data classification level. Client created with status "active". |
| BA-02 | As an admin, I conduct a structured onboard interview to assess the client's needs | Interview form: use case, data sources, expected volume, compliance needs, AICM assessment. System recommends archetype and escalation tier based on answers. Saved to Cosmos DB. |
| BA-03 | As an admin, I assign a workspace type to a client with specific configuration | Select workspace type → set capacity limit → choose model(s) from registry → set escalation tier → configure chunking strategy → apply function valves. Client sees workspace in Portal 1. |
| BA-04 | As an admin, I manage prompt versions and can rollback if quality degrades | Prompt list with version history. View diffs between versions. Rollback to previous version. Change logged with author and rationale. |
| BA-05 | As an admin, I manage the model registry (enable/disable models, set parameter overrides) | Model list with status toggle. Per-model: parameter overrides (temperature, top-p), classification ceiling, access grants (which clients/groups). |
| BA-06 | As an admin, I view and approve/reject booking requests from clients | Booking queue with filters (client, status, date). Approve → triggers workspace provisioning (IaC). Reject → reason required, client notified. |
| BA-07 | As an admin, I view a dashboard of all clients with usage metrics | Client cards: query count, document count, storage used, cost, avg satisfaction, last active. Filterable, sortable. |
| BA-08 | As an admin, I configure function valves per workspace without code changes | Schema-driven config UI: search top-k, reranker threshold, embedding model, chunking parameters, translation preferences. Changes apply to workspace immediately. |
| BA-09 | As an admin, I suspend or offboard a client | Suspend: disable workspace access, retain data. Offboard: triggers governed decommission (P52 cleanup doctrine). Both logged in audit trail. |
| BA-10 | As an admin, I provision a new workspace and its Azure resources through the portal (no CLI, no Terraform manual runs) | "Create Workspace" panel: name, archetype, capacity → click "Provision" → dry-run preview (what will be created: blob containers, AI Search index, Entra group bindings) → confirm → IaC executes → status tracks provisioning (pending → provisioning → ready). Admin never touches CLI or Azure portal. |
| BA-11 | As an admin, I decommission a workspace with governed safety gates | "Decommission" action on workspace: dry-run shows what will be removed (members, documents, index entries, containers). Safety gates: must confirm member removal plan, must confirm document deletion plan, must type workspace name to confirm. Follows P52 cleanup doctrine (no direct content/index deletion — use DA-native delete cascade). Audit receipt generated. |
| BA-12 | As an admin, I export a workspace configuration as a snapshot (JSON/CSV) and import it to create a new workspace from template | Export: dumps workspace config, member UPNs (semicolon-separated for Excel compatibility), document manifest, settings. Import: upload snapshot → diff preview (what will change) → confirm → workspace provisioned from template. |
| BA-13 | As an admin, I view the provisioning status and resource health of all workspaces | Workspace infrastructure dashboard: cards per workspace showing provisioning_status, resource health (blob container exists, index exists, Entra group bound), document count, index doc count, last activity. Alert on orphaned resources or drift. |
| BA-14 | As an admin, I manage workspace member access (add/remove users, change roles) across all workspaces | Centralized member management: search user → see all workspace memberships → add to workspace with role → remove from workspace. Bulk operations for team changes. Changes reflected in Entra ID group and workspace_grants. |

**Data-model-driven IaC architecture (P52 evolution → self-service infrastructure automation):**

The BusAdmin data model IS the infrastructure specification. Every workspace attribute in Cosmos DB maps to an Azure resource parameter. When an admin configures a workspace through Portal 2, they're authoring a Bicep deployment — they just don't know it.

**How it works:**

```
BusAdmin data model (Cosmos DB)          Bicep template engine          Azure resources
┌─────────────────────────┐              ┌──────────────────┐          ┌──────────────────┐
│ WorkspaceConfig {       │              │                  │          │                  │
│   name: "EI Juris"      │──renders──→  │ workspace.bicep  │──deploys→│ Blob containers  │
│   archetype: "case_law" │              │ (parameterized)  │          │ AI Search index  │
│   capacity: 15          │              │                  │          │ Entra group      │
│   model: "gpt-5.1"      │              └──────────────────┘          │ RBAC bindings    │
│   embedding: "ada-002"  │                                            │ Queue bindings   │
│   reranker: true        │              ┌──────────────────┐          └──────────────────┘
│   search_sku: "standard"│──renders──→  │ workspace.       │
│   chunking: "citation_  │              │ parameters.json  │
│     aware"              │              │ (from data model) │
│   escalation: "review"  │              └──────────────────┘
│   retention_days: 90    │
│   extraction_engine:    │              ┌──────────────────┐
│     "doc_intelligence"  │──submits──→  │ ACA Job /        │
│   ...                   │              │ Service Bus msg   │
└─────────────────────────┘              │ (deployment task) │
                                         └──────────────────┘
```

**BusAdmin workspace data model (the infrastructure spec):**
```
WorkspaceConfig {
  id, name, description, archetype,
  
  # Compute & capacity
  capacity_users: int,                    # Max concurrent users
  
  # AI Search index parameters
  search_index_sku: "basic|standard|s2",  # Drives AI Search pricing
  vector_dimensions: 1536,                # Embedding model output size
  semantic_reranker: bool,                # Enable semantic ranking
  
  # Model assignment
  chat_model: "gpt-5-mini|gpt-5.1",      # From model registry
  embedding_model: "text-embedding-ada-002|text-embedding-3-large",
  
  # Ingestion config
  chunking_strategy: "default|legislation|case_law",
  chunk_target_size: int,                 # Token target per chunk
  extraction_engine: "doc_intelligence|tika",
  supported_file_types: string[],
  
  # Storage
  upload_container_name: string,          # Generated: eva-ws-{id}-upload
  content_container_name: string,         # Generated: eva-ws-{id}-content
  retention_days: int,                    # After booking completion
  
  # Governance
  escalation_tier: "auto|review|human",
  classification_ceiling: "unclassified|protected_a|protected_b",
  grounding_required: bool,
  
  # Access
  entra_group_id: string,
  role_assignments: [{principal_id, role}],
  
  # Valves (function config overrides)
  valves: {
    search_top_k: int,
    reranker_threshold: float,
    translation_target: "en|fr",
    ...
  }
}
```

**Every field in this model maps to an Azure resource parameter.** The Bicep template engine reads the data model and generates deployment parameters:

| Data model field | Bicep parameter | Azure resource |
|-----------------|-----------------|----------------|
| `search_index_sku` | `searchServiceSkuName` | AI Search index tier |
| `vector_dimensions` | `vectorSize` | Index schema `contentVector` field |
| `semantic_reranker` | `semanticSearchEnabled` | Semantic configuration |
| `chat_model` | `openAiDeploymentName` | Foundry connection |
| `embedding_model` | `embeddingDeploymentName` | Embedding endpoint |
| `upload_container_name` | `containerName` | Blob Storage container |
| `content_container_name` | `containerName` | Blob Storage container |
| `entra_group_id` | `principalId` | Role assignment |
| `role_assignments` | `roleDefinitionId` + `principalId` | RBAC bindings |
| `retention_days` | `lifecyclePolicyDays` | Blob lifecycle rule |

**Deployment execution (self-service, no CLI, no Terraform manual runs):**

```
BusAdmin clicks "Provision Workspace" in Portal 2
  → API: POST /admin/workspaces/provision (dry_run=true)
  → Backend:
    1. Reads WorkspaceConfig from Cosmos
    2. Renders workspace.bicep parameters from data model fields
    3. Runs `az deployment group what-if` (Bicep dry-run)
    4. Returns: plan {
        "resources": [
          {"type": "storage/container", "name": "eva-ws-{id}-upload", "action": "create"},
          {"type": "search/index", "name": "eva-workspace-{id}-index", "action": "create", "sku": "standard"},
          {"type": "authorization/roleAssignment", "principal": "group-{id}", "role": "contributor", "action": "create"}
        ],
        "estimated_monthly_cost": "$X CAD",
        "deployment_time_estimate": "~3 minutes"
      }
  → Admin reviews dry-run → confirms
  → API: POST /admin/workspaces/provision (dry_run=false)
  → Backend submits deployment as **ACA Job** or **Service Bus message**:
    1. Job picks up WorkspaceConfig + rendered Bicep parameters
    2. Executes `az deployment group create` (Bicep deployment)
    3. Creates blob containers, AI Search index (schema from archetype), Entra group bindings
    4. Verifies all resources provisioned (health checks)
    5. Updates WorkspaceResources in Cosmos: status → ready
    6. Generates audit receipt (JSON: who, when, what resources, Bicep template version)
  → Admin sees status: pending → provisioning → ready (real-time via polling or Service Bus notification)
  → Workspace appears in Portal 1 catalog for assigned client
```

**Why ACA Jobs / Service Bus for deployment execution:**
- Deployments can take 1-5 minutes — too long for a synchronous API call
- ACA Job runs the Bicep deployment as an isolated container with managed identity
- Service Bus provides reliable delivery + retry semantics
- Admin gets status updates without holding an HTTP connection
- Same pattern P75 uses for its execution bus (`msub-eva-vnext-bus`)

**Self-service decommission (same data-model-driven pattern):**
```
BusAdmin clicks "Decommission" on workspace
  → API reads WorkspaceConfig → knows exactly which resources exist
  → Renders decommission Bicep (or imperative script) from data model
  → Dry-run: shows what will be removed (containers, index, group bindings, documents)
  → Safety gates: member removal plan, document deletion plan, name confirmation
  → Executes as ACA Job following P52 cleanup doctrine:
    1. Remove members from Entra group
    2. Delete files through DA-native delete cascade
    3. Verify downstream cleanup
    4. Purge Cosmos status-history
    5. Delete blob containers + AI Search index
    6. Archive WorkspaceConfig snapshot for audit
    7. Update status: archived
    8. Audit receipt
```

**Self-service modification:**
```
BusAdmin changes workspace config (e.g., upgrades search SKU, changes model assignment)
  → Data model updated in Cosmos
  → Bicep parameters re-rendered from updated model
  → Incremental deployment: only changed resources updated
  → Audit trail: diff of what changed, who changed it, when
```

**Key principle:** The BusAdmin data model is the single source of truth. Azure resources are a projection of that model. If the model says `semantic_reranker: true`, the index has semantic reranking. If someone changes it to `false` in the portal, a deployment job updates the index. The infrastructure always converges to the data model state.

**Governed decommission (P52 cleanup doctrine):**
```
BusAdmin clicks "Decommission" on workspace
  → API: POST /admin/workspaces/{id}/decommission (dry_run=true)
  → Returns: plan {
      "members_to_remove": ["alice@gc.ca (contributor)", "bob@gc.ca (reader)"],
      "documents_to_delete": 147,
      "index_entries_to_purge": 892,
      "cosmos_status_rows_to_purge": 147,
      "containers_to_delete": ["eva-ws-{id}-upload", "eva-ws-{id}-content"],
      "safety_gates": ["member_removal_plan", "document_deletion_plan", "name_confirmation"]
    }
  → Admin completes safety gates
  → API: POST /admin/workspaces/{id}/decommission (dry_run=false)
  → Backend executes P52 cleanup doctrine:
    1. Remove members from Entra group
    2. Delete files through DA-native delete cascade (NOT direct blob/index deletion)
    3. Verify downstream cleanup completion
    4. Purge Cosmos status-history rows
    5. Archive workspace config snapshot (retained for audit)
    6. Update WorkspaceResources status: archived
    7. Generate audit receipt
```

**Storyboard (client onboarding + workspace provisioning):**
```
1. Sign in (admin persona) → Admin dashboard
2. Click "Onboard Client" → Step 1: org name, billing contact
3. Step 2: Entra ID group mapping (search/select group)
4. Step 3: Data classification level (Protected B)
5. Step 4: Onboard interview — use case (EI case law), data sources, volume, compliance
6. System recommends: archetype (case_law), escalation tier (flagged-for-review), model (GPT-4o)
7. Admin adjusts if needed → confirms → client created
8. Click "Provision Workspace" → select archetype → set capacity
9. Dry-run preview: "Will create: 2 blob containers, 1 AI Search index, 1 Entra group binding"
10. Admin confirms → watches provisioning status: pending → provisioning → ready
11. Click "Assign to Client" → select client → set roles
12. Client user signs into Portal 1 → sees assigned workspace in catalog
13. Admin monitors workspace health + client usage on dashboard
```

---

### Portal 3 — Operations & Support (ops team)

**Users:** Platform operations team managing EVA DA Workspaces and other RAG solutions across FinOps, AIOps, LiveOps, DevOps

**Data model (reads from telemetry + platform state):**
```
CostRecord {timestamp, client_id, workspace_id, model_id, tokens_in, tokens_out, compute_cost, storage_cost, search_cost, apim_headers{}}
OutcomeMetric {conversation_id, resolution_rate, time_to_answer_ms, citation_accuracy, confidence_score, escalation_tier, user_feedback}
ServiceHealth {service_name, status (healthy|degraded|down), queue_depth, error_rate, latency_p99, last_checked}
AgentTrace {trace_id, correlation_id, conversation_id, steps[], total_duration_ms, model_version, prompt_version, corpus_snapshot}
AlertRule {id, metric, condition, threshold, severity, notification_channel, is_active}
DeploymentRecord {id, environment, version, status (success|failed|rolled_back), deployed_at, deployed_by}
CorpusHealth {index_name, document_count, last_refreshed, staleness_days, avg_freshness_score}
EloRating {model_id, archetype, rating, matches_played, last_updated}
ConfidenceCalibration {model_id, archetype, predicted_confidence_bucket, actual_accuracy, sample_size, period}
SourceQuality {corpus_id, acceptance_rate, correction_rate, quality_score, sample_size}
FeedbackAggregate {period, corrections_count, patterns[], guardrail_gaps[], retrieval_quality_trend}
```

**User stories:**

| ID | Story | Acceptance |
|----|-------|-----------|
| OP-01 | As ops, I view cost breakdown by client, workspace, and model with budget alerts | FinOps dashboard: cost charts (daily/weekly/monthly), drillable by client → workspace → model. Budget thresholds with alert configuration. |
| OP-02 | As ops, I view outcome-based metrics alongside cost (not just consumption) | Outcome dashboard: resolution rate, time-to-answer, citation accuracy, confidence calibration — per client and per model. |
| OP-03 | As ops, I trace any conversation end-to-end through the agent execution chain | Agent trace explorer: select conversation → see full OTEL trace: each tool invocation, provenance, policy decisions, duration, model/prompt versions. |
| OP-04 | As ops, I monitor service health and receive alerts on degradation | LiveOps grid: service cards (api-gateway, doc-pipeline, enrichment, AI Search, Cosmos, APIM) with status, queue depths, error rates. Alert rules configurable. |
| OP-05 | As ops, I compare model performance per archetype using the evaluation arena | Elo leaderboard: model rankings per archetype (legislation, case law, FAQ, dashboard). Based on user feedback from Portal 1. Drill into individual comparisons. |
| OP-06 | As ops, I manage content extraction engines per document type | Config panel: map document types (PDF, DOCX, images) to extraction engines (Document Intelligence, Tika, etc.). Test extraction on sample document. |
| OP-07 | As ops, I monitor corpus health and freshness across all workspaces | Corpus health dashboard: index cards with document count, last refreshed, staleness score. Alert when index exceeds refresh cadence. |
| OP-08 | As ops, I review confidence calibration and source quality trends | Calibration chart: predicted confidence vs. actual accuracy per model/archetype. Source quality: acceptance rate per corpus. Identify miscalibrated domains and low-quality sources. |
| OP-09 | As ops, I review feedback loop analytics (correction patterns, guardrail gaps) | Feedback dashboard: correction volume trends, common correction patterns, guardrail gaps detected, retrieval quality trends. |
| OP-10 | As ops, I view deployment history and CI/CD status | DevOps panel: recent deployments with status, environment, version. Link to GitHub Actions. Infrastructure drift alerts. |

**Command centers (OpsSup sub-dashboards):**

Each ops discipline gets its own command center — a focused dashboard with the tools and views specific to that function.

**FinOps Command Center (consumes P75 `/v1/products/aca/*` + P77 reference):**
- **Does NOT rebuild cost extraction** — P77's FOCUS 1.2-preview pipeline is the reference; P75 exposes it as APIs
- Cost attribution waterfall: P75 APIM logs → by client → by workspace → by model → by token type (input/output)
- P75 scan API (`POST /v1/products/aca/scan`) → waste score, optimization candidates for P53's Azure resources
- P77 executive metrics contract: monthly trend, top services, top resource groups — consumed as JSON
- Outcome-based KPIs alongside cost: resolution rate, time-to-answer, citation accuracy per dollar spent
- Budget management: set thresholds per client/workspace, alert rules, burn-rate projections
- Chargeback reports: exportable per billing period, per client, per cost center (from exit survey data)
- Cost anomaly detection: P77's z-score + CV% data science engine, surfaced in dashboard

**AIOps Command Center:**
- RAG quality metrics: groundedness, relevance, coherence — trended over time, per workspace, per archetype
- Agent trace explorer: search conversations → full OTEL trace with tool invocations, provenance, policy decisions
- Evaluation arena: model Elo leaderboard per archetype, side-by-side comparison drill-down
- Confidence calibration: predicted vs actual accuracy heatmap per model/archetype/language
- Source quality scores: per-corpus acceptance/correction rates, low-quality source flagging
- Corpus health: index freshness, document counts, staleness alerts, refresh cadence monitoring
- Drift detection: automated alerts when quality metrics cross thresholds

**LiveOps Command Center:**
- Service health grid: api-gateway, doc-pipeline, AI Search, Cosmos DB, APIM, Azure OpenAI — each with status, latency p99, error rate
- Queue monitoring: depth per queue (pdf-submit, non-pdf-submit, text-enrichment, embeddings), processing rate, backlog age
- Workspace utilization: active bookings vs capacity per workspace type, index sizes, storage consumption
- Incident timeline: alerts, degradation events, recovery actions — chronological view
- Capacity planning: growth projections based on workspace creation rate, document volume, query volume

**DevOps Command Center:**
- CI/CD pipeline status: last N builds per branch, test results, lint/type-check status
- Deployment history: environment → version → status → deployed_by → timestamp
- Environment promotion gates: dev → staging → prod with manual approval
- Infrastructure drift: Terraform plan diff alerts (actual vs desired state)
- Container health: ACA revision status, image versions, rollback capability

**Storyboard (investigating a quality issue):**
```
1. Sign in (ops Entra ID group) → Ops dashboard overview
2. AIOps: notice citation accuracy dropped 15% for "legislation" archetype this week
3. Click → drill into confidence calibration → model says "high confidence" but accuracy is 65%
4. Click → agent trace explorer → select recent low-accuracy conversation
5. See trace: search tool found 3 sources, but 2 were from 2024 (stale)
6. Check corpus health → OAS Act index last refreshed 45 days ago (threshold: 30)
7. Check feedback loop → 8 corrections this week on OAS-related queries, pattern: "outdated section references"
8. Action: flag corpus for refresh, adjust staleness decay curve, notify BusAdmin
9. After corpus refresh → confidence calibration improves → citation accuracy recovers
10. Document the incident in deployment/change log
```

---

## Repository Structure

```
53-EVA-Refactor/
├── infra/                              # P53-specific IaC (P75 chassis provides the rest)
│   ├── main.bicep                      # P53 resources: storage, cosmos, APIM product
│   ├── p75-integration.bicep           # References to P75's APIM, VNet, Foundry, Service Bus
│   ├── variables.bicepparam
│   ├── environments/                   # dev.bicepparam, staging.bicepparam
│   └── modules/
│       ├── storage/                    # P53 workspace blob containers + queues
│       ├── cosmos/                     # P53 databases (statusdb, eva-workspaces, demo-users)
│       ├── apim-product/               # Register eva-agentic product on P75's APIM
│       └── identity/                   # P53-specific managed identities + scoped roles
│   # NOT HERE (provided by P75): network, apim instance, openai, ai-foundry,
│   # container-apps env, acr, keyvault, monitoring, doc-intelligence
├── packages/
│   ├── eva-common/                     # Shared types, constants, i18n, policy schemas
│   │   └── src/
│   │       ├── types/                  # workspace, chat, user, provenance, audit
│   │       ├── i18n/                   # en.json, fr.json
│   │       ├── policy/                 # Compliance-as-code rule schemas
│   │       └── constants.ts
│   └── eva-ui-kit/                     # Shared UI (React 19 + shadcn)
│       └── src/
│           ├── components/
│           │   ├── ui/                 # shadcn primitives
│           │   ├── chat/               # ChatPanel, AgentStepTrace, CitationViewer, ProvenanceBadge
│           │   ├── layout/             # AppShell, NavBar, Sidebar
│           │   └── a11y/              # SkipLink, LiveRegion, FocusTrap
│           └── hooks/
│               ├── use-ndjson-stream.ts
│               ├── use-i18n.ts
│               └── use-auth.ts
├── apps/
│   ├── portal-self-service/            # Portal 1 — customer-facing
│   ├── portal-admin/                   # Portal 2 — AICoE admin
│   └── portal-ops/                     # Portal 3 — Ops & Support
├── services/
│   ├── api-gateway/                    # FastAPI backend
│   │   └── app/
│   │       ├── main.py / config.py / dependencies.py
│   │       ├── routers/                # chat, documents, workspaces, teams, bookings, surveys, admin, ops, health
│   │       ├── agents/
│   │       │   ├── orchestrator.py     # ReAct loop — observable, every step traced
│   │       │   ├── planner.py          # Goal decomposition + step reflection
│   │       │   ├── memory.py           # Session (Redis/Cosmos) + semantic (AI Search)
│   │       │   └── identity.py         # Per-agent scoped identity + delegation chain
│   │       ├── tools/                  # Agent tools — each with metadata declaration
│   │       │   ├── registry.py         # classification_ceiling, residency, bilingual, escalation_tier
│   │       │   ├── search.py           # Hybrid search (query gen → embed → search → rank)
│   │       │   ├── cite.py             # Citation resolution with provenance
│   │       │   ├── translate.py        # EN↔FR translation
│   │       │   ├── classify.py         # Document classification + routing
│   │       │   └── ingest.py           # Document ingestion tool
│   │       ├── models/                 # Model registry
│   │       │   ├── registry.py         # Enable/disable models, parameter overrides, access per workspace
│   │       │   ├── prompts.py          # Versioned prompt management with rollback
│   │       │   └── evaluation.py       # Elo-based model comparison from user feedback
│   │       ├── guardrails/
│   │       │   ├── policy_engine.py    # Compliance-as-code: executable TBS/ESDC rules
│   │       │   ├── escalation.py       # Tiered: auto → review → human-required (confidence-driven)
│   │       │   ├── confidence.py       # Confidence scoring: retrieval relevance, source coverage, grounding quality
│   │       │   ├── freshness.py        # Temporal validity: staleness checks, decay curves, supersession detection
│   │       │   ├── degradation.py      # Graceful degradation: circuit breakers, fallback hierarchy, disclosure
│   │       │   ├── conflict.py         # Multi-agent conflict detection, surfacing, arbitration
│   │       │   ├── content_safety.py   # Azure Content Safety
│   │       │   ├── grounding.py        # Citation requirement enforcement
│   │       │   ├── prompt_shield.py    # Prompt injection defense
│   │       │   └── audit.py            # OTEL-compatible forensic audit trail
│   │       ├── explainability/
│   │       │   ├── reasoning.py        # Structured reasoning summary (not raw chain-of-thought)
│   │       │   ├── retrieval_path.py   # Which sources considered/used/excluded and why
│   │       │   └── negative_evidence.py # Disclosure of what was NOT found
│   │       ├── feedback/
│   │       │   ├── capture.py          # Correction capture (what was wrong, correct answer, why)
│   │       │   ├── calibration.py      # Confidence calibration loop (predicted vs actual accuracy)
│   │       │   └── source_quality.py   # Source quality scoring from user acceptance signals
│   │       ├── provenance/
│   │       │   ├── tracker.py          # Per-request provenance: source docs, steps, policies
│   │       │   ├── correlation.py      # Correlation IDs across the full chain
│   │       │   └── models.py           # ProvenanceRecord, DelegationChain, PolicyDecision
│   │       ├── models/                 # Pydantic domain models
│   │       └── core/
│   │           ├── apim.py             # APIM client with FinOps + outcome headers
│   │           └── telemetry.py        # OTEL spans, metrics, structured logging
│   ├── doc-pipeline/                   # Document processing (Azure Functions or ACA jobs)
│   │   ├── handlers/                   # file_uploaded, pdf_extract, layout_parse, enrich, embed, index
│   │   ├── extraction/                 # Pluggable content extraction engines
│   │   │   ├── base.py                # Abstract extractor interface
│   │   │   ├── doc_intelligence.py    # Azure Document Intelligence
│   │   │   ├── tika.py                # Apache Tika (fallback)
│   │   │   └── factory.py             # Engine selection per document type config
│   │   ├── chunking/                   # Archetype-configurable chunking strategies
│   │   │   ├── base.py                # Abstract chunker
│   │   │   ├── default.py             # Token-based with structure awareness
│   │   │   ├── legislation.py         # Hierarchical (parts → sections → subsections)
│   │   │   └── case_law.py            # Citation-graph-aware chunking
│   │   └── shared/                     # Status tracking, blob helpers
│   └── enrichment/                     # Embedding service (may collapse into api-gateway)
├── search/indexes/
│   └── vector-index.json               # AI Search schema with workspace_id, provenance fields
├── scripts/ tests/ docs/
├── docker-compose.yml
├── Makefile
└── .github/workflows/ci.yml
```

---

## Phase 0 — Scaffold & Integration with P75 Chassis

**Goal:** Working project structure integrated with P75 EVA-vNext infrastructure. Local dev running, CI passing. P53 is a product on the P75 chassis — not a standalone deployment.

**What P75 already provides (DO NOT rebuild):**
- APIM public edge (`msub-eva-vnext-apim`) with JWT validation, correlation IDs, rate limits
- Azure AI Foundry + OpenAI deployments (gpt-5-mini, gpt-5.1, gpt-5.1-codex-mini) in Canada East
- Azure AI Search service
- Document Intelligence (Form Recognizer)
- VNet (10.42.0.0/16) with private subnets (APIM, apps, data) + private endpoints
- Service Bus execution bus (`msub-eva-vnext-bus`) with work item queues
- Application Insights + OpenTelemetry instrumentation
- Entra ID + JWT/JWKS auth infrastructure
- Evidence storage account with lifecycle policies
- Managed identities with least-privilege RBAC

**What P53 provisions (P53-specific resources only):**
- Storage Account for P53 workspaces: blob containers (per-workspace upload + content), storage queues (pdf-submit, non-pdf-submit, text-enrichment, embeddings, image-enrichment)
- Cosmos DB containers: `statusdb` (pipeline status), `eva-workspaces` (workspaces, bookings, teams, surveys, clients, interviews), `demo-users` (demo auth plane)
- AI Search indexes: created dynamically per workspace (not at infra time)
- ACR images: api-gateway, doc-pipeline containers (pushed to P75's ACR or dedicated)
- APIM product registration: register P53 APIs as a product on P75's APIM (`eva-agentic` product with routes `/v1/eva/*`)

**Deliverables:**
- Repo structure initialized
- P53 Terraform/Bicep provisions P53-specific resources in marcusub, wired to P75's VNet and APIM
- APIM product `eva-agentic` registered on P75's APIM with FinOps header policy (`x-app-id`, `x-user-group`, `x-classification`, `x-workspace-id`)
- Docker Compose for local dev: api-gateway (:8000), doc-pipeline (:7071), Azurite (:10000-10002), portal-self-service (:5173), Jaeger (:16686 — local OTEL trace viewer)
- GitHub Actions CI: lint (ruff + ESLint), type-check (pyright + tsc), test (pytest + vitest), build containers
- Demo auth plane: `demo_users` config with 5 personas, `AUTH_MODE=demo` provider
- **Provenance model** defined: `ProvenanceRecord`, `DelegationChain`, `PolicyDecision` Pydantic schemas
- **Audit schema** defined: OTEL span structure for agent actions (subject, actor, purpose, resource, policy_decision)

**Key files:**
- `infra/main.bicep` — P53-specific resources (storage, cosmos, APIM product registration)
- `infra/p75-integration.bicep` — references to P75's existing APIM, VNet, Foundry, Service Bus
- `docker-compose.yml` (includes Jaeger for local trace viewing)
- `services/api-gateway/app/main.py` (health endpoint + OTEL middleware)
- `services/api-gateway/app/auth/demo_provider.py` — demo user plane
- `services/api-gateway/app/auth/middleware.py` — AUTH_MODE switch (demo|production)
- `services/api-gateway/app/core/telemetry.py` — OTEL setup (feeds P75's App Insights)
- `services/api-gateway/app/provenance/models.py` — provenance schemas
- `packages/eva-common/src/types/provenance.ts` — frontend provenance types
- `.github/workflows/ci.yml`

**Verification:**
- P53 resources deploy to marcusub alongside P75 resources
- APIM product `eva-agentic` visible in P75's APIM portal
- `docker compose up` → `curl localhost:8000/health` returns 200 with trace ID
- Jaeger shows the health check span
- CI passes on PR
- Demo login page shows 5 personas, selecting one sets all auth context

**Dependencies:** P75 EVA-vNext infrastructure deployed (Phase A complete — confirmed)

---

## Phase 1 — Agentic Baseline (Chat + RAG + Ingestion)

**Goal:** Working agentic chat with RAG against one index. Document upload triggers observable ingestion pipeline. Every operation traced, every answer carries provenance. One index, no RBAC, no portals beyond basic chat UI.

**Deliverables:**

### Ingestion (observable pipeline)
- `POST /documents/upload` accepts files, stores in Blob upload container
- Pipeline: detect type → extract (Document Intelligence) → chunk → embed (Azure OpenAI via APIM) → index (AI Search)
- Each stage is an **OTEL span** with: input document hash, output chunk count, latency, errors
- Status tracked in Cosmos DB per-file (same functional requirement as MSIA `status_log`)
- **Chunking is archetype-configurable**: default strategy is token-based with structure awareness (same functional result as MSIA `utilities.py`). Architecture supports legislation and case-law strategies.

### Agentic Chat
- `POST /chat` returns NDJSON stream
- **ReAct orchestrator** plans and executes tools:
  - `search`: generate optimized query → embed → hybrid search (vector + keyword + semantic reranker)
  - `cite`: resolve document references to SAS-signed URLs with page numbers
  - `answer`: generate response grounded in retrieved sources with pinpoint citations
- **Each tool invocation is an OTEL span** logged with: tool name, agent identity, input hash, output hash, latency, policy decisions applied
- **Provenance on every answer (includes confidence, explainability, freshness):**
  ```json
  {
    "answer": "The OAS Act requires...",
    "citations": [{"file": "oas-act.pdf", "page": 12, "section": "3(1)", "sas_url": "...", "last_verified": "2026-03-01"}],
    "provenance": {
      "correlation_id": "uuid",
      "agent_id": "eva-rag-agent",
      "delegation_chain": ["user-request", "orchestrator", "search-tool", "cite-tool", "answer-tool"],
      "sources_consulted": 5,
      "sources_cited": 2,
      "sources_excluded": 1,
      "exclusion_reasons": ["superseded by newer version"],
      "policies_applied": ["grounding-required", "protected-b-boundary"],
      "confidence": 0.87,
      "confidence_factors": {"retrieval_relevance": 0.92, "source_coverage": 0.85, "grounding_quality": 0.84},
      "escalation_tier": "auto-resolve",
      "freshness": {"oldest_source": "2026-01-15", "newest_source": "2026-03-01", "staleness_warning": false},
      "behavioral_fingerprint": {"model": "gpt-4o-2025-04", "prompt_version": "v3.2", "corpus_snapshot": "2026-04-10", "policy_rules": ["v1.4"]},
      "trace_id": "otel-trace-uuid"
    },
    "explainability": {
      "retrieval_summary": "5 sources retrieved from OAS Act corpus; 3 selected based on section relevance; 1 excluded (superseded)",
      "reasoning_summary": "Section 3(1) establishes age threshold of 65; section 3(2) defines pro-rata calculation for partial pension",
      "negative_evidence": ["No amendments found after 2025-12-01"],
      "cross_language": null
    }
  }
  ```
- **Ungrounded chat** (direct GPT, no RAG) — clearly labeled, no citation claims, provenance shows `sources_consulted: 0`

### NDJSON stream protocol
```
{"provenance": {"correlation_id": "...", "trace_id": "..."}}
{"agent_step": {"id": 1, "tool": "search", "status": "running", "label_en": "Searching documents", "label_fr": "Recherche de documents"}}
{"agent_step": {"id": 1, "tool": "search", "status": "complete", "duration_ms": 1234, "sources_found": 5}}
{"agent_step": {"id": 2, "tool": "cite", "status": "complete", "citations_resolved": 2}}
{"content": "Based on section 3(1) of the OAS Act [File0]..."}
{"provenance_complete": {"sources_cited": 2, "policies_applied": ["grounding-required"], "escalation_tier": "auto-resolve"}}
```

### Model Registry
- Models registered with: id, name, provider (Azure OpenAI), deployment_name, capabilities, parameter_overrides, classification_ceiling, is_active
- Default model: GPT-4o. Model selection per workspace configurable in Phase 3.
- **Prompt versioning**: system prompts stored with version history. Every change creates a new version with author, timestamp, diff. Rollback supported.

### Content Extraction Abstraction
- Pluggable extraction engine behind `base.py` interface
- Default: Azure Document Intelligence. Factory selects engine based on document type config.
- Architecture supports adding Tika, Docling, or other engines without pipeline changes.

### APIM
- All Azure OpenAI calls routed through APIM
- FinOps headers: `x-app-id`, `x-user-group`, `x-classification`
- Outcome headers logged: `x-sources-consulted`, `x-sources-cited`, `x-escalation-tier`

### Chat UI (minimal, in portal-self-service)
- Chat page with NDJSON streaming
- Agent step trace viewer (collapsible, shows each tool invocation)
- Citation links with provenance badge
- Accessible: `aria-live="polite"` for step announcements

### AI Search Index
- HNSW vector (cosine, configurable dimensions) + BM25 keyword + semantic reranker
- Fields: content, contentVector, file_name, title, section, pages, workspace_id, chunk_file, file_uri, entities, key_phrases, ingestion_trace_id (provenance link)

**Key files:**
- `services/api-gateway/app/agents/orchestrator.py` — ReAct loop with OTEL tracing
- `services/api-gateway/app/agents/identity.py` — per-agent scoped identity
- `services/api-gateway/app/tools/search.py` — hybrid search tool
- `services/api-gateway/app/tools/cite.py` — citation with provenance
- `services/api-gateway/app/tools/registry.py` — tool declarations with metadata
- `services/api-gateway/app/provenance/tracker.py` — per-request provenance assembly
- `services/api-gateway/app/provenance/correlation.py` — correlation ID propagation
- `services/api-gateway/app/guardrails/grounding.py` — citation enforcement
- `services/api-gateway/app/guardrails/audit.py` — OTEL forensic logging
- `services/api-gateway/app/guardrails/escalation.py` — tiered escalation logic
- `services/api-gateway/app/routers/chat.py` — streaming endpoint
- `services/api-gateway/app/routers/documents.py` — upload/status/delete
- `services/doc-pipeline/handlers/file_uploaded.py` — type detection + routing
- `services/doc-pipeline/chunking/default.py` — token-based chunking
- `services/api-gateway/app/core/apim.py` — APIM client with FinOps + outcome headers
- `apps/portal-self-service/src/pages/ChatPage.tsx`
- `packages/eva-ui-kit/src/components/chat/AgentStepTrace.tsx`
- `packages/eva-ui-kit/src/components/chat/ProvenanceBadge.tsx`
- `search/indexes/vector-index.json`

**Azure resources (from P75 chassis):** Azure OpenAI (gpt-5-mini + gpt-5.1, already deployed), AI Search (already deployed), Document Intelligence (already deployed). P53 registers as consumer via APIM product + managed identity roles. **P53-specific:** first workspace AI Search index created, doc-pipeline deployed as ACA job or Function App.

**Verification:**
- Upload PDF → each pipeline stage visible as OTEL span in App Insights → status "Complete" in Cosmos
- Chat about document → NDJSON stream with agent steps + provenance + citations
- Provenance object on response includes: correlation_id, delegation_chain, sources_consulted vs. sources_cited, policies_applied
- Click citation → SAS-signed blob opens with page reference
- No-match question → "I don't have enough information", provenance shows `sources_cited: 0`
- Ungrounded chat → provenance shows `sources_consulted: 0`, no citation claims
- APIM analytics show FinOps headers + outcome headers on all calls
- Jaeger/App Insights: full distributed trace from user request through orchestrator → tools → Azure OpenAI → response

**Dependencies:** Phase 0

---

## Phase 2 — Self-Service Portal (Portal 1)

**Goal:** Full customer-facing portal with workspace management, booking lifecycle, team RBAC, surveys, cost recovery. Chat scoped to booked workspace. Entra ID SSO.

**Deliverables:**
- **Workspace catalog** (`GET /workspaces`) — types with capacity/features/pricing/archetype config (Cosmos DB)
- **Booking lifecycle** (`POST/PATCH/DELETE /bookings`) — create → active → completed. Each booking provisions a scoped AI Search index with archetype-appropriate chunking config.
- **Team management** (`CRUD /teams/:bookingId/members`) — Reader/Contributor/Admin. Enforced at Blob + AI Search level via Entra ID.
- **Entry/exit surveys** — intake captures use case, expected outcomes, data classification. Exit captures results, lessons, satisfaction, cost recovery (department, cost center, approver).
- **Multi-index chat** — chat scoped to user's active workspace via `workspace_id` filter in search. Provenance includes workspace context.
- **Persistent memories** — per-user semantic memory collection in AI Search. Agent accumulates context about user's role, past queries, preferences across conversations. Configurable per workspace.
- **Artifact storage** — KV store for stateful agent interactions. Agents can persist drill-down history, conversation bookmarks, case evaluation progress across sessions.
- **Entra ID SSO** — MSAL auth in frontend, APIM JWT validation, user claims flow to backend.

**Key files:**
- `services/api-gateway/app/routers/workspaces.py`, `bookings.py`, `teams.py`, `surveys.py`
- `services/api-gateway/app/models/workspace.py` — Workspace, Booking, TeamMember, Survey
- `apps/portal-self-service/src/pages/WorkspaceCatalog.tsx`, `MyBookings.tsx`
- `apps/portal-self-service/src/components/BookingDialog.tsx`, `TeamManagementDialog.tsx`, `ExitSurveyDialog.tsx`
- `packages/eva-common/src/types/workspace.ts`
- `packages/eva-ui-kit/src/hooks/use-auth.ts` (MSAL)

**Azure resources:** Entra ID app registration, Cosmos DB containers (workspaces, bookings, surveys, teams)

**Verification:**
- SSO sign in → workspace catalog visible
- Book workspace → entry survey → status "active" → AI Search index provisioned
- Add Contributor → they can upload. Add Reader → they cannot (403).
- Upload + chat scoped to workspace → provenance includes `workspace_id`
- Exit survey → booking "completed" → cost summary with department/cost center

**Dependencies:** Phase 1

---

## Phase 3 — Business Admin Portal (Portal 2)

**Goal:** AICoE administrators manage the platform's client base: onboarding, workspace assignment, interviews, central booking oversight.

**Deliverables:**
- **Client onboarding** — org creation, Entra ID group mapping, billing contact, data classification level
- **Workspace assignment** — assign workspace type to client, set capacity, configure escalation tier (auto/review/human), set archetype chunking strategy
- **Onboard interview** — structured intake: use case, data sources, expected volume, compliance requirements, AICM assessment
- **Central booking management** — view/approve/reject all bookings across clients
- **Client dashboard** — usage per client (queries, docs, storage, costs, outcome metrics from FinOps headers)
- **Compliance-as-code config** — admin configures which policy rules apply per workspace (grounding required, escalation tier, classification ceiling)
- **Function valves** — schema-driven configuration UI for tools and pipeline settings per workspace. BusAdmin tunes search top-k, reranker threshold, chunking strategy, translation preferences — no code changes needed.
- **Prompt versioning UI** — admin views prompt version history, compares diffs, can rollback. Every prompt change auditable.
- **Model assignment per workspace** — BusAdmin selects which model(s) a workspace can use from the model registry. GPT-4o for complex, GPT-4o-mini for FAQ.

**Key files:**
- `services/api-gateway/app/routers/admin.py` — admin endpoints with role enforcement
- `services/api-gateway/app/models/client.py` — Client, Interview, Assignment
- `services/api-gateway/app/guardrails/policy_engine.py` — per-workspace policy configuration
- `apps/portal-admin/src/pages/ClientOnboarding.tsx`, `WorkspaceAssignment.tsx`, `OnboardInterview.tsx`, `Dashboard.tsx`

**Azure resources:** Entra ID admin group, Cosmos DB containers (clients, interviews), APIM admin API product

**Verification:**
- Admin onboards client → assigns workspace with escalation_tier=review → client sees workspace in Portal 1
- Chat in that workspace → provenance shows `escalation_tier: "flagged-for-review"`, response held until reviewer approves
- Admin dashboard shows per-client: query count, document count, avg citation accuracy, cost

**Dependencies:** Phase 2

---

## Phase 4 — Ops & Support Portal (Portal 3)

**Goal:** Platform management across FinOps, AIOps, LiveOps, DevOps. Relies heavily on Azure OOTB (APIM analytics, Log Analytics, Azure Monitor) with custom dashboards.

**Deliverables:**

### FinOps
- Cost attribution pipeline: APIM logs → Log Analytics → KQL aggregation
- Dashboard: cost per client, per workspace, per model. Budget alerts.
- **Outcome-based metrics** alongside consumption: resolution rate, time-to-answer, citation accuracy (from outcome headers logged by APIM)

### AIOps
- RAG quality dashboard: groundedness (% sentences with citations), relevance (search result quality), coherence
- **Agent trace explorer**: select any conversation → see full OTEL trace with tool invocations, provenance, policy decisions
- **Evaluation arena**: users compare responses from different models side-by-side. Elo ratings computed per model per archetype. Evidence-based model selection — which model works best for legislation vs. case law vs. dashboards.
- Foundry evaluation integration: scheduled red-teaming and quality measurement
- Drift detection: alert when groundedness or citation accuracy drops below threshold
- **Confidence calibration dashboard**: predicted confidence vs. actual accuracy over time. Identifies domains where confidence scoring is miscalibrated.
- **Source quality dashboard**: per-corpus quality scores based on user acceptance signals. Flag low-quality sources for review.
- **Corpus health monitoring**: alert when an index hasn't been refreshed past its expected cadence
- **Extraction engine management**: OpsSup configures which content extraction engine (Document Intelligence, Tika, etc.) handles which document types
- **Feedback loop analytics**: correction patterns, guardrail gap detection, retrieval quality trends

### LiveOps
- Service health: ACA container status, queue depths, AI Search index sizes, Cosmos RU consumption
- Azure Monitor alert rules: queue depth > threshold, RU > 80%, container restarts
- Capacity planning: workspace utilization vs. capacity limits

### DevOps
- CI/CD status from GitHub Actions
- Deployment history with environment promotion gates
- Infrastructure drift detection (Terraform plan diff)

**Key files:**
- `services/api-gateway/app/routers/ops.py` — ops metrics endpoints
- `apps/portal-ops/src/pages/FinOpsDashboard.tsx`, `AIOpsMonitor.tsx`, `LiveOpsHealth.tsx`, `DevOpsPipelines.tsx`
- `infra/modules/monitoring/alerts.tf` — Azure Monitor rules
- `infra/modules/monitoring/kql/` — FinOps and AIOps KQL queries

**Azure resources:** Azure Monitor alerts, Log Analytics saved queries, Foundry evaluations

**Verification:**
- FinOps: cost breakdown by client matches APIM logs. Outcome metrics (citation accuracy, resolution rate) displayed alongside cost. Budget alert fires on threshold.
- AIOps: select conversation → full agent trace visible with provenance. Groundedness score computed for 10 test conversations.
- LiveOps: all services healthy. Simulate container crash → alert within 5 min.
- DevOps: last 10 deployments visible with status.

**Dependencies:** Phase 3 (needs real client usage generating telemetry)

---

## Phase 5 — Governance & Hardening

**Goal:** Full compliance validation. Everything that was designed-in from Phase 0 is now audited end-to-end.

**Deliverables:**
- **RBAC audit** — Reader/Contributor/Admin enforced at every layer: APIM, API Gateway, Blob Storage, AI Search, Cosmos DB
- **Escalation tier audit** — auto-resolve, flagged-for-review, requires-human-decision all working with confidence thresholds per workspace
- **Compliance-as-code audit** — policy engine rules verified: grounding enforcement, classification ceiling, data residency, bilingual requirement
- **WCAG 2.1 AA** — axe-core automated + manual audit of all three portals. Agent step trace accessible via screen reader. Keyboard nav complete.
- **Bilingual** — all strings in `en.json`/`fr.json`, system prompts parameterized, translation tool for non-bilingual content
- **Protected B** — no public IPs, VNet-only, TLS 1.3, encryption at rest, no PII in logs, Canada Central/East only
- **Security** — ITSG-33 control mapping, prompt injection test suite (OWASP LLM Top 10), content safety evaluation, agent impersonation tests, cascading failure tests, secret scanning in CI
- **Sandbox & simulation testing** — production-like sandbox with mirrored indices/policies/configs. SME-validated scenario suites per domain. Red-teaming protocol (prompt injection, bilingual confusion, edge cases). Load and degradation testing. Bias/fairness audits across EN/FR. Pre-deployment gate: no agent update goes live without passing sandbox.
- **Graceful degradation validation** — simulate component failures (search down, model throttled, corpus unavailable). Verify fallback hierarchy and user disclosure at each tier.
- **Confidence calibration validation** — verify confidence scoring across EN/FR parity. Confirm escalation triggers fire at correct thresholds.
- **Provenance audit** — every answer in the last 30 days has a complete provenance record (with confidence, explainability, freshness, behavioral fingerprint) retrievable by correlation_id

**Key files:**
- `tests/e2e/a11y.spec.ts` — WCAG automated tests
- `tests/security/test_prompt_injection.py` — OWASP LLM Top 10 vectors
- `tests/security/test_agent_impersonation.py` — agent identity spoofing
- `tests/audit/test_provenance_completeness.py` — verify all answers have provenance
- `docs/compliance/itsg33-mapping.md`
- `packages/eva-common/src/i18n/fr.json` (complete)

**Verification:**
- Reader gets 403 on upload. Contributor gets 403 on team management.
- Workspace with escalation_tier=human: agent completes reasoning, holds response, human approves/rejects with audit entry.
- axe-core: 0 critical/serious violations. Screen reader announces agent steps.
- French toggle: all UI + chat prompts + provenance labels render in French.
- nmap: no public endpoints. Log Analytics query: no PII in any log entry.
- Prompt injection suite: all 10 attack vectors blocked.
- `GET /provenance/{correlation_id}` returns full chain for any conversation in last 30 days.

**Dependencies:** Phase 4

---

## Cross-Cutting (invariants, not afterthoughts)

| Concern | When | How |
|---------|------|-----|
| **OTEL tracing** | Phase 0 onward | Every request gets a trace. Every agent tool call is a span. Jaeger local, App Insights prod. |
| **Provenance** | Phase 1 onward | Every answer carries: correlation_id, delegation_chain, sources, policies, confidence, escalation_tier |
| **APIM FinOps** | Phase 0 onward | Headers: x-app-id, x-user-group, x-classification, x-workspace-id. Outcome headers from Phase 1. |
| **Agent identity** | Phase 0 onward | Per-service managed identity. Per-agent logical identity in orchestrator. Delegation chain tracked. |
| **Compliance-as-code** | Phase 1 onward | Policy engine evaluates rules per request. Config per workspace from Phase 3. |
| **Escalation tiers** | Phase 1 onward | Default: auto-resolve. Configurable per workspace from Phase 3. |
| **Bilingual i18n** | Phase 0 onward | English first. All strings externalized. French parity in Phase 5. |
| **Accessible agent steps** | Phase 1 onward | aria-live="polite" for step announcements. Screen reader tested in Phase 5. |
| **Archetype chunking** | Phase 1 onward | Default strategy first. Legislation + case law strategies from Phase 2 workspace config. |
| **Model registry** | Phase 1 onward | Models registered with capabilities + classification ceiling. Per-workspace assignment from Phase 3. |
| **Prompt versioning** | Phase 1 onward | Every system prompt versioned. Admin rollback UI from Phase 3. |
| **Pluggable extraction** | Phase 1 onward | Factory pattern for content extraction engines. OpsSup config from Phase 4. |
| **Persistent memories** | Phase 2 onward | Per-user semantic memory in AI Search. Configurable per workspace. |
| **Evaluation arena** | Phase 4 | Elo-based model comparison from user feedback. Feeds model selection decisions. |
| **Confidence scoring** | Phase 1 onward | Every answer carries computed confidence. Feeds escalation tiers. Calibrated over time. |
| **Explainability** | Phase 1 onward | Retrieval path + reasoning summary + negative evidence on every response. Auditor drill-down. |
| **Source freshness** | Phase 1 onward | last_verified mandatory on index. Staleness disclosure. Corpus health monitoring from Phase 4. |
| **Graceful degradation** | Phase 1 onward | Circuit breakers + fallback hierarchy. Validated in Phase 5. |
| **Feedback loops** | Phase 2 onward | See detailed feedback loop architecture below. |
| **Conflict resolution** | Phase 4 onward | Needed when multiple agents/workspaces overlap. IIAID marketplace readiness. |
| **Behavioral versioning** | Phase 1 onward | Fingerprint on every response. Rollback from Phase 3 (prompt versioning UI). |
| **Sandbox testing** | Phase 5 | Pre-deployment gate. No agent update goes live without passing. |
| **Contextual adaptation** | Phase 2 onward | Plain language defaults. Channel-appropriate rendering. Full audit in Phase 5. |

---

## Implementation Contracts (prevent blockers during autonomous execution)

### Cosmos DB container design

| Database | Container | Partition key | RU model | TTL | Purpose |
|----------|-----------|--------------|----------|-----|---------|
| `eva-workspaces` | `workspaces` | `/id` | Serverless | None | Workspace type definitions + configs |
| `eva-workspaces` | `bookings` | `/workspace_id` | Serverless | None | Booking lifecycle records |
| `eva-workspaces` | `teams` | `/booking_id` | Serverless | None | Team members per booking |
| `eva-workspaces` | `surveys` | `/booking_id` | Serverless | None | Entry + exit surveys |
| `eva-workspaces` | `clients` | `/id` | Serverless | None | Client orgs (Portal 2) |
| `eva-workspaces` | `interviews` | `/client_id` | Serverless | None | Onboard interviews |
| `eva-workspaces` | `workspace-resources` | `/workspace_id` | Serverless | None | Provisioned Azure resources per workspace |
| `eva-workspaces` | `workspace-snapshots` | `/workspace_id` | Serverless | 365d | Config export/import snapshots |
| `eva-platform` | `prompt-versions` | `/prompt_name` | Serverless | None | Versioned system prompts |
| `eva-platform` | `model-registry` | `/id` | Serverless | None | Model configs + access grants |
| `eva-platform` | `feedback` | `/workspace_id` | Serverless | 180d | Thumbs + corrections |
| `eva-platform` | `question-analytics` | `/workspace_id` | Serverless | 90d | Anonymized question clusters |
| `eva-platform` | `demo-users` | `/email` | Serverless | None | Demo auth personas |
| `statusdb` | `statuscontainer` | `/file_name` | Serverless | 90d | Document processing pipeline status |
| `statusdb` | `chat-history` | `/user_id` | Serverless | Configurable (7-365d) | Conversation history |
| `statusdb` | `memories` | `/user_id` | Serverless | Configurable (90d default) | Per-user semantic memories |
| `statusdb` | `artifacts` | `/user_id` | Serverless | None | Stateful agent KV store |

### API route table (registered on P75 APIM as `eva-agentic` product)

```
# Chat & RAG
POST   /v1/eva/chat                          # NDJSON streaming chat (grounded or ungrounded)
POST   /v1/eva/chat/feedback                  # Thumbs up/down + correction

# Documents
POST   /v1/eva/documents/upload               # Upload file to workspace
GET    /v1/eva/documents/status                # Query processing status
GET    /v1/eva/documents/:id                   # Get document metadata
DELETE /v1/eva/documents/:id                   # Delete document + index cleanup
POST   /v1/eva/documents/:id/resubmit          # Requeue failed document
GET    /v1/eva/documents/tags                   # List tags in workspace

# Citations
GET    /v1/eva/citations/:id                   # Get citation metadata + provenance
GET    /v1/eva/citations/:id/file              # Download cited file (SAS URL)

# Workspaces (Portal 1 — self-service)
GET    /v1/eva/workspaces                      # List available workspaces (RBAC-filtered)
GET    /v1/eva/workspaces/:id                  # Get workspace detail

# Bookings (Portal 1)
POST   /v1/eva/bookings                        # Create booking
GET    /v1/eva/bookings                        # List my bookings
PATCH  /v1/eva/bookings/:id                    # Update booking status
DELETE /v1/eva/bookings/:id                    # Cancel booking

# Teams (Portal 1)
GET    /v1/eva/teams/:bookingId/members        # List team members
POST   /v1/eva/teams/:bookingId/members        # Add member
PATCH  /v1/eva/teams/:bookingId/members/:userId # Change role
DELETE /v1/eva/teams/:bookingId/members/:userId # Remove member

# Surveys (Portal 1)
POST   /v1/eva/surveys/entry                   # Submit entry survey
POST   /v1/eva/surveys/exit                    # Submit exit survey

# Admin (Portal 2 — BusAdmin)
POST   /v1/eva/admin/clients                   # Onboard client
GET    /v1/eva/admin/clients                   # List clients
GET    /v1/eva/admin/clients/:id               # Client detail + usage
PATCH  /v1/eva/admin/clients/:id               # Update / suspend / offboard
POST   /v1/eva/admin/interviews                # Submit onboard interview
POST   /v1/eva/admin/workspaces/provision      # Provision workspace (dry_run param)
POST   /v1/eva/admin/workspaces/:id/decommission # Decommission workspace (dry_run param)
GET    /v1/eva/admin/workspaces/:id/resources  # Workspace resource health
POST   /v1/eva/admin/workspaces/:id/snapshot   # Export workspace config
POST   /v1/eva/admin/workspaces/import         # Import workspace from snapshot
GET    /v1/eva/admin/bookings                  # All bookings (cross-client)
PATCH  /v1/eva/admin/bookings/:id              # Approve / reject booking
GET    /v1/eva/admin/models                    # Model registry
PATCH  /v1/eva/admin/models/:id                # Enable/disable, parameter overrides
GET    /v1/eva/admin/prompts                   # Prompt versions
POST   /v1/eva/admin/prompts/:name/rollback    # Rollback to version
PATCH  /v1/eva/admin/workspaces/:id/valves     # Update function valves

# Ops (Portal 3 — OpsSup)
GET    /v1/eva/ops/health                      # Service health grid
GET    /v1/eva/ops/metrics/finops              # FinOps metrics (proxied from P75)
GET    /v1/eva/ops/metrics/aiops               # RAG quality, confidence calibration
GET    /v1/eva/ops/metrics/liveops             # Queue depths, capacity, utilization
GET    /v1/eva/ops/traces/:conversationId      # Full OTEL trace for conversation
GET    /v1/eva/ops/corpus-health               # Index freshness, doc counts
GET    /v1/eva/ops/feedback-analytics          # Correction patterns, gap detection
GET    /v1/eva/ops/evaluation-arena            # Model Elo rankings
GET    /v1/eva/ops/deployments                 # Deployment history

# System
GET    /v1/eva/health                          # Health check with dependency status
GET    /v1/eva/system/info                     # Model versions, prompt versions, corpus dates
GET    /v1/eva/provenance/:correlationId       # Full provenance chain for any conversation

# Auth (demo mode only — disabled in production)
GET    /v1/eva/auth/demo/users                 # List demo personas
POST   /v1/eva/auth/demo/login                 # Select persona → returns UserContext
```

### Error response contract

All errors follow the same shape — no surprises during frontend implementation:

```json
{
  "error": {
    "code": "WORKSPACE_NOT_FOUND",
    "message": "Workspace ws-123 does not exist or you don't have access",
    "details": {},
    "correlation_id": "uuid",
    "trace_id": "otel-trace-uuid"
  }
}
```

| HTTP status | When |
|-------------|------|
| 400 | Invalid request (missing fields, bad format) |
| 401 | Not authenticated (no token / invalid token) |
| 403 | Authenticated but not authorized (wrong role, wrong workspace) |
| 404 | Resource not found |
| 409 | Conflict (booking already exists, duplicate upload) |
| 429 | Rate limited (APIM enforced) |
| 500 | Internal error (includes correlation_id for tracing) |
| 503 | Service degraded (includes which dependency is down) |

### Local dev mock strategy

AI Search, Azure OpenAI, and Document Intelligence have no local emulators. Strategy for `docker compose up` without Azure:

| Dependency | Local dev strategy |
|-----------|-------------------|
| Azure Blob Storage | Azurite (full emulation) |
| Azure Queue Storage | Azurite (full emulation) |
| Cosmos DB | Cosmos DB emulator (Linux container) or Cosmos DB serverless (dev instance — cheap) |
| Azure OpenAI | **Real endpoint required** — use P75's dev deployment (gpt-5-mini). Env var `AZURE_OPENAI_ENDPOINT`. Low-cost model for dev. |
| Azure AI Search | **Real endpoint required** — use P75's dev instance. Create dev indexes with `_dev_` prefix. |
| Document Intelligence | **Real endpoint required** — use P75's dev instance. Or mock: stub extraction returns hardcoded chunks for test PDFs. |
| APIM | Bypass in local dev — api-gateway called directly. `APIM_BYPASS=true` env var. |
| Service Bus | Bypass in local dev — use in-memory queue. `SERVICE_BUS_BYPASS=true`. |
| Entra ID | Demo auth mode (`AUTH_MODE=demo`). No real tokens needed. |

**Seed data script** (`scripts/seed-data.sh`):
- Creates 3 demo workspaces (FAQ, Legislation, Case Law)
- Uploads 5 test documents (2 PDFs, 1 DOCX, 1 CSV, 1 JSON)
- Processes through pipeline → indexed and searchable
- Populates demo users, bookings, team members
- After seed: developer can immediately chat with test data

### Naming conventions

| Thing | Pattern | Example |
|-------|---------|---------|
| Azure resource group | `eva-agentic-{env}` | `eva-agentic-dev` |
| Storage account | `evaagentic{env}{random}` | `evaagenticdev7x2k` |
| Blob containers | `eva-ws-{workspace_id}-upload`, `eva-ws-{workspace_id}-content` | `eva-ws-abc123-upload` |
| Storage queues | `eva-{queue_name}` | `eva-pdf-submit` |
| AI Search indexes | `eva-workspace-{workspace_id}-index` | `eva-workspace-abc123-index` |
| Cosmos databases | `eva-workspaces`, `eva-platform`, `statusdb` | — |
| APIM product | `eva-agentic` | — |
| API routes | `/v1/eva/{domain}/{resource}` | `/v1/eva/admin/clients` |
| Python packages | `eva_agentic.{module}` | `eva_agentic.agents.orchestrator` |
| TS packages | `@eva/{package}` | `@eva/common`, `@eva/ui-kit` |
| Docker images | `eva-agentic-{service}:{version}` | `eva-agentic-api-gateway:0.1.0` |
| OTEL service name | `eva-agentic-{service}` | `eva-agentic-api-gateway` |
| OTEL span names | `eva.{domain}.{operation}` | `eva.agent.search`, `eva.pipeline.chunk` |
| Bicep files | `{resource-type}.bicep` | `workspace-storage.bicep` |
| Test files | `test_{module}.py` / `{Component}.test.tsx` | `test_orchestrator.py` |

### Test strategy

| Layer | Framework | What it tests | Coverage target |
|-------|-----------|--------------|----------------|
| **Python unit** | pytest | Tools, guardrails, provenance, models, chunking | 80% on core logic |
| **Python integration** | pytest + real Azure (dev) | Full chat flow, document pipeline, workspace provisioning | Key paths |
| **Frontend unit** | vitest + testing-library | Components, hooks, i18n, auth | 70% |
| **Frontend a11y** | axe-core + vitest | WCAG 2.1 AA automated checks | 0 critical/serious |
| **E2E** | Playwright | Golden path per portal (3 scenarios) | P1: chat + upload, P2: onboard + provision, P3: trace + dashboard |
| **Security** | pytest | Prompt injection (OWASP LLM Top 10), RBAC bypass, agent impersonation | 10 attack vectors |
| **Regression** | pytest + curated Q&A pairs | Known-good answers validated by SMEs — run before any deployment | Per archetype |

### Work session boundaries (for autonomous execution)

Each autonomous session should have a clear scope and "done" definition:

**Phase 0 sessions:**
1. Repo scaffold + package.json + pyproject.toml + Docker Compose + CI workflow
2. Bicep infra (P53-specific resources) + P75 integration references
3. Demo auth plane (providers + middleware + demo login page)
4. Provenance + audit schemas (Pydantic + TypeScript types)

**Phase 1 sessions:**
5. API gateway skeleton (FastAPI app factory + all routers as stubs + health endpoint)
6. Document pipeline (file_uploaded + pdf_extract + layout_parse handlers)
7. Chunking engine (default + archetype interface + table parser)
8. Text enrichment handler (language detect + translate + entities + key phrases)
9. Embedding + indexing (Azure OpenAI via APIM + AI Search index upsert)
10. Agent orchestrator (ReAct loop + search tool + cite tool + OTEL tracing)
11. Guardrails (confidence scoring + grounding enforcement + escalation tiers + freshness)
12. Explainability module (retrieval path + reasoning summary + negative evidence)
13. Chat streaming endpoint (NDJSON with agent steps + provenance + citations)
14. Portal 1 chat UI (ChatPage + streaming + AgentStepTrace + ProvenanceBadge + CitationViewer)
15. Portal 1 document upload UI (upload + status tracking + pipeline visualization)

**Phase 2 sessions:**
16. Workspace + booking CRUD (routers + Cosmos + workspace index provisioning)
17. Team management (RBAC enforcement at API + search + blob level)
18. Surveys + cost recovery
19. Feedback capture (thumbs + corrections + storage)
20. Persistent memories (per-user semantic memory in AI Search)
21. Portal 1 workspace catalog + booking wizard + my bookings UI
22. Portal 1 team management + exit survey UI
23. Entra ID SSO integration (when ready — swappable via AUTH_MODE)

**Phase 3 sessions:**
24. Client + interview CRUD (Portal 2 backend)
25. Data-model-driven IaC engine (WorkspaceConfig → Bicep parameters → ACA Job deployment)
26. Governed decommission engine (P52 cleanup doctrine)
27. Model registry + prompt versioning (backend)
28. Function valves engine (schema-driven config)
29. Portal 2 UI (all pages)

**Phase 4 sessions:**
30. FinOps Command Center (P75 API consumption + dashboard)
31. AIOps Command Center (traces + evaluation arena + confidence calibration)
32. LiveOps Command Center (health grid + queue monitoring)
33. DevOps Command Center (deployment history)
34. Feedback analytics dashboard
35. Portal 3 UI (all pages)

**Phase 5 sessions:**
36. WCAG 2.1 AA audit + fixes
37. Bilingual completeness (fr.json parity)
38. Security testing (prompt injection suite + RBAC audit)
39. Sandbox environment + regression suite
40. Protected B compliance validation

---

## Feedback Loop Architecture (Principle 6 + 13)

Four feedback streams, each flowing from user signals through analysis to system improvement:

### Stream 1: Answer feedback (thumbs up/down + corrections)

```
User clicks 👍 or 👎 on answer → optional correction text + reason
  → Stored: FeedbackRecord {
      conversation_id, message_id, workspace_id, user_id,
      signal (accept|reject), correction_text, reason,
      original_answer_hash, cited_sources[], confidence_score,
      model_version, prompt_version, created_at
    }
  → Aggregated nightly (privacy-safe, anonymized):
    - Per-workspace acceptance rate
    - Per-model acceptance rate by archetype
    - Per-source acceptance rate (which corpus leads to accepted vs rejected answers)
  → Feeds:
    - Confidence calibration (AIOps: predicted confidence vs actual acceptance)
    - Source quality scores (AIOps: flag low-quality corpora)
    - Model evaluation arena (AIOps: Elo ratings adjusted by feedback)
```

### Stream 2: Question analysis (what are users asking?)

```
Every user question logged (anonymized):
  → QuestionAnalytics {
      workspace_id, archetype, language, topic_cluster,
      had_answer (bool), sources_found (int), confidence_score,
      escalation_triggered (bool), created_at
    }
  → Clustered weekly (topic modelling on anonymized questions):
    - What topics are users asking about most?
    - Where are the coverage gaps (questions with no good sources)?
    - Which topics have lowest confidence / highest rejection rate?
  → Feeds:
    - Content gap reports (BusAdmin: "users keep asking about X but corpus has no coverage")
    - Corpus refresh priorities (OpsSup: which indexes need more/better content)
    - Workspace archetype tuning (BusAdmin: is this workspace's chunking strategy right for these questions?)
```

### Stream 3: Agent learning (persistent memory)

```
Agent accumulates per-user semantic memory:
  → MemoryRecord {
      user_id, workspace_id, content, embedding_vector,
      source (explicit_save|implicit_learn), confidence, created_at
    }
  → Explicit: user says "remember that I work on EI appeals for Ontario region"
  → Implicit: agent detects recurring patterns (user always asks about specific Act sections,
    user prefers detailed citations, user works in French)
  → Memory consulted at query time: relevant memories injected into agent context
  → Memory management:
    - User can view, edit, delete their memories (Portal 1 settings)
    - Memories scoped to workspace (don't leak across workspaces)
    - Retention: configurable per workspace (default 90 days)
    - Privacy: memories are per-user, never shared, never aggregated
```

### Stream 4: Tool performance (which tools work, which don't)

```
Every tool invocation tracked (from OTEL spans):
  → ToolPerformance {
      tool_name, workspace_id, archetype,
      latency_ms, success (bool), error_type,
      downstream_acceptance (was the answer using this tool accepted?),
      created_at
    }
  → Aggregated:
    - Tool reliability: success rate, avg latency, error patterns
    - Tool effectiveness: does using this tool lead to accepted answers?
    - Tool configuration impact: do certain valve settings improve outcomes?
  → Feeds:
    - Function valve tuning recommendations (BusAdmin: "increasing top-k from 3 to 5 improved acceptance by 12%")
    - Tool registry health (OpsSup: search tool latency trending up — scaling issue?)
    - Extraction engine effectiveness (OpsSup: Document Intelligence vs Tika acceptance rates per file type)
```

### Feedback dashboard (Portal 3 — AIOps Command Center)

| View | What it shows |
|------|-------------|
| Correction patterns | Top correction reasons, recurring errors, by workspace/archetype |
| Content gap report | Topics where users ask but corpus has no/poor coverage |
| Confidence calibration | Predicted confidence vs actual acceptance heatmap |
| Source quality | Per-corpus acceptance rate, trending, low-quality flags |
| Memory growth | Per-workspace memory usage, most-recalled memories |
| Tool effectiveness | Tool success/acceptance rates, valve tuning impact |
| Guardrail gap detection | Corrections that reveal missing compliance-as-code rules |
