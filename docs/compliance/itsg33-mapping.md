# NIST 800-53 Security Control Mapping -- AIA

> Classification: sensitive | Last updated: 2026-04-15
>
> This document maps NIST 800-53 security controls to AIA implementation artefacts.
> All compute and data reside in Canada Central / Canada East. No public IPs.

---

## AC -- Access Control

| Control ID | Control Name | AIA Implementation | Evidence Location |
|-----------|-------------|-------------------|------------------|
| AC-2 | Account Management | Entra ID SSO with group-based RBAC. Demo mode uses proforma users (Bob/Alice/Carol/Dave/Eve) with role enforcement. User personas defined with workspace_grants, portal_access, and role attributes. | `services/api-gateway/app/auth/demo_provider.py`, `services/api-gateway/app/auth/entra_provider.py`, `services/api-gateway/app/auth/models.py` |
| AC-3 | Access Enforcement | Role-based authorization (Reader/Contributor/Admin) enforced at router level via `require_role()` and `require_portal()` decorators. Workspace-scoped access filtered by `workspace_grants`. Admin and Ops portals gated by `portal_access` claims. | `services/api-gateway/app/auth/middleware.py`, `services/api-gateway/app/auth/group_mapping.py`, `tests/security/test_rbac_bypass.py` |
| AC-4 | Information Flow Enforcement | APIM gateway enforces traffic routing -- all AI calls pass through Azure APIM with JWT validation, rate limiting, and FinOps cost-attribution headers (`x-app-id`, `x-user-group`, `x-classification`). VNet/SCED boundary prevents direct access. | `services/api-gateway/app/middleware/apim_simulation.py`, `infra/modules/apim-product/`, `CLAUDE.md` (L2 architecture) |
| AC-6 | Least Privilege | Three-tier RBAC model: Readers query only, Contributors upload + manage, Admins manage workspaces and models. Ops portal requires explicit `portal_access` grant separate from admin role. Workspace grants are per-user, not global. | `services/api-gateway/app/auth/models.py`, `services/api-gateway/app/routers/admin.py`, `services/api-gateway/app/routers/ops.py` |
| AC-17 | Remote Access | All access via Entra ID SSO over TLS 1.3. APIM acts as the single public-facing edge within SCED. Private endpoints for all Azure PaaS services (Cosmos DB, AI Search, Key Vault, Storage). No direct access to backend services. | `infra/main.bicep`, `infra/modules/keyvault/`, `infra/environments/` |

---

## AU -- Audit and Accountability

| Control ID | Control Name | AIA Implementation | Evidence Location |
|-----------|-------------|-------------------|------------------|
| AU-2 | Audit Events | Every agent step logs: tool name, input hash, latency, output hash. OpenTelemetry spans on every tool invocation (search, cite, translate, answer). Provenance records built per response with full delegation chain. | `services/api-gateway/app/core/telemetry.py`, `services/api-gateway/app/provenance/tracker.py`, `services/api-gateway/app/guardrails/audit.py` |
| AU-3 | Content of Audit Records | Provenance record includes: correlation_id, trace_id, agent_id, delegation_chain, confidence_factors, behavioral_fingerprint (model + prompt_version + corpus_snapshot + policy_rules_version), sources_cited, policies_applied. | `services/api-gateway/app/provenance/models.py`, `services/api-gateway/app/provenance/correlation.py` |
| AU-6 | Audit Review, Analysis, and Reporting | Weekly log review process (AUD01). Telemetry store captures all interaction metrics. Ops portal exposes traces, AIOps metrics, and corpus health dashboards. | `services/api-gateway/app/stores/telemetry_store.py`, `services/api-gateway/app/routers/ops.py` |
| AU-9 | Protection of Audit Information | Dual authentication required for log access (Entra ID + special permissions). PostgreSQL log access gated by Entra ID + AD group. No PII in Azure Log Analytics (AUD02/AUD05). Input/output stored as hashes, not plaintext. | `services/api-gateway/app/core/sanitizer.py`, `CLAUDE.md` (Logging requirements) |
| AU-12 | Audit Generation | OpenTelemetry SDK initialized at startup, exports to Azure Monitor via Application Insights. Batch span processor ensures non-blocking telemetry export. Console fallback for local development. | `services/api-gateway/app/core/telemetry.py`, `services/api-gateway/app/config.py` |

---

## CM -- Configuration Management

| Control ID | Control Name | AIA Implementation | Evidence Location |
|-----------|-------------|-------------------|------------------|
| CM-2 | Baseline Configuration | Infrastructure as Code via Bicep templates. All Azure resources (Cosmos DB, AI Search, APIM, Key Vault, Storage, Identity) defined declaratively with environment-specific parameter files. | `infra/main.bicep`, `infra/modules/`, `infra/environments/` |
| CM-3 | Configuration Change Control | Prompt versioning with full history: each workspace stores `business_prompt_version` and `business_prompt_history` with author, rationale, and timestamp. Model registry tracks enabled/disabled models with parameter overrides. | `services/api-gateway/app/stores/workspace_store.py`, `services/api-gateway/app/stores/model_registry_store.py`, `services/api-gateway/app/stores/prompt_store.py` |
| CM-6 | Configuration Settings | Behavioral fingerprinting on every response: model version, prompt version, corpus snapshot timestamp, policy rules version. Settings centralized in `config.py` with environment variable overrides. | `services/api-gateway/app/provenance/models.py` (`BehavioralFingerprint`), `services/api-gateway/app/config.py` |
| CM-8 | Information System Component Inventory | Tool registry requires every tool to declare at registration: classification ceiling, data residency, bilingual support, HITL-required flag. No shadow tooling permitted -- all tools go through change advisory. | `services/api-gateway/app/tools/registry.py`, `services/api-gateway/app/tools/__init__.py` |

---

## IA -- Identification and Authentication

| Control ID | Control Name | AIA Implementation | Evidence Location |
|-----------|-------------|-------------------|------------------|
| IA-2 | Identification and Authentication (Organizational Users) | Entra ID SSO for production. Demo mode provides proforma login with `x-demo-user-email` header mapping to predefined personas (5 users with distinct roles and workspace grants). | `services/api-gateway/app/auth/entra_provider.py`, `services/api-gateway/app/auth/demo_provider.py` |
| IA-3 | Device Identification and Authentication | APIM JWT/JWKS validation at the gateway layer. Tokens validated against Entra ID tenant. All API requests require valid authentication -- unauthenticated requests return 401. | `services/api-gateway/app/middleware/apim_simulation.py`, `tests/security/test_rbac_bypass.py` (`TestNoAuth`) |
| IA-5 | Authenticator Management | Entra ID manages credential lifecycle (password policies, MFA, token refresh). Application uses MSAL React (`@azure/msal-react`) for frontend token acquisition. No local credential storage. | `CLAUDE.md` (UI/UX stack -- Auth layer), `services/api-gateway/app/auth/entra_provider.py` |
| IA-8 | Identification and Authentication (Non-Organizational Users) | Not applicable -- AIA is internal to Organization. All users authenticate via Entra ID organizational accounts. External access explicitly denied at SCED boundary. | `CLAUDE.md` (Hard constraints -- SCED/VNet) |

---

## SC -- System and Communications Protection

| Control ID | Control Name | AIA Implementation | Evidence Location |
|-----------|-------------|-------------------|------------------|
| SC-8 | Transmission Confidentiality and Integrity | TLS 1.3 enforced on all communications. APIM terminates external TLS; internal traffic uses private endpoints within VNet. No plaintext channels. | `infra/modules/apim-product/`, `infra/main.bicep` |
| SC-12 | Cryptographic Key Establishment and Management | Azure Key Vault manages all secrets (Cosmos keys, OpenAI keys, Search API keys, Storage connection strings). Application retrieves secrets at startup via Key Vault references, never hardcoded. | `infra/modules/keyvault/`, `services/api-gateway/app/config.py` |
| SC-13 | Cryptographic Protection | Encryption at rest via Azure platform-managed keys for Cosmos DB, Blob Storage, and AI Search indexes. All data classified sensitive or lower. | `infra/modules/cosmos/`, `infra/modules/storage/` |
| SC-28 | Protection of Information at Rest | All Azure resources provisioned in Canada Central / Canada East only (data residency). Cosmos DB, Blob Storage, and AI Search enforce server-side encryption. Daily incremental backups to paired public-sector region. | `infra/environments/`, `scripts/backup/`, `services/api-gateway/app/stores/workspace_store.py` (infrastructure config) |

---

## SI -- System and Information Integrity

| Control ID | Control Name | AIA Implementation | Evidence Location |
|-----------|-------------|-------------------|------------------|
| SI-3 | Malicious Code Protection | Content safety filtering via Azure AI Content Safety. PromptShield detects direct injection, indirect injection, data exfiltration, jailbreaks (DAN, developer mode, role confusion, delimiter injection, ChatML tokens). | `services/api-gateway/app/guardrails/content_safety.py`, `services/api-gateway/app/guardrails/prompt_shield.py`, `tests/security/test_prompt_injection.py` |
| SI-4 | Information System Monitoring | OpenTelemetry tracing on every agent step. AIOps metrics: RAG quality (groundedness, relevance, coherence), model performance, drift detection. LiveOps: service health, SLA tracking, capacity planning. | `services/api-gateway/app/core/telemetry.py`, `services/api-gateway/app/routers/ops.py` |
| SI-10 | Information Input Validation | Grounding enforcement ensures responses are derived from retrieved sources. Citation requirements mandate pinpoint references (file, page, section, SAS URL). Confidence scoring with retrieval_relevance, source_coverage, grounding_quality. | `services/api-gateway/app/guardrails/grounding.py`, `services/api-gateway/app/guardrails/confidence.py`, `services/api-gateway/app/provenance/models.py` |
| SI-16 | Memory Protection | No fine-tuning on user data (AUD06). No retraining on user queries. RAG-first architecture retrieves from trusted sources only. RAI gate logic enforces HITL checkpoints for Level 2+ (decision-informing) outputs. | `services/api-gateway/app/guardrails/escalation.py`, `services/api-gateway/app/guardrails/policy_engine.py`, `services/api-gateway/app/guardrails/policy_rules.json` |

---

## SA -- Security Assessment and Authorization

| Control ID | Control Name | AIA Implementation | Evidence Location |
|-----------|-------------|-------------------|------------------|
| SA-11 | Developer Security Testing | Red-team automation suite covering 14 attack scenarios: prompt injection (direct/indirect), data exfiltration, jailbreaks (DAN, developer mode, bypass), role confusion, delimiter injection, ChatML/INST tokens. Risk-level calibration (low/medium/high). | `scripts/red-team/run_red_team.py`, `tests/security/test_prompt_injection.py`, `tests/security/test_agent_impersonation.py` |
| SA-15 | Development Process, Standards, and Tools | Security testing integrated into CI/CD. RBAC bypass tests (5 role categories, 35+ assertions). Agent impersonation tests verify provenance immutability, delegation chain integrity, correlation ID uniqueness. | `tests/security/test_rbac_bypass.py`, `tests/security/test_agent_impersonation.py`, `.github/workflows/` |
| SA-22 | Unsupported System Components | Certification automation with 35 automated checks. Certification report generated as JSON + Markdown artefacts. Backup recovery testing validates daily incremental restore capability. | `scripts/certify/run_certification.py`, `evidence/certification-report.json`, `evidence/certification-report.md` |
| SA-9 | External Information System Services | All AI calls routed through Azure APIM -- never direct to Azure OpenAI. FinOps cost-attribution headers on every request (`x-app-id`, `x-user-group`, `x-classification`). FOCUS 1.2-preview cost extraction from P77 via P75 APIs. | `services/api-gateway/app/middleware/apim_simulation.py`, `CLAUDE.md` (Hard constraints) |

---

## Cross-cutting controls

| Aspect | Implementation | Evidence |
|--------|---------------|---------|
| Data residency | Canada Central / Canada East only. All Bicep templates hardcode `canadacentral` location. No cross-border data flows. | `infra/main.bicep`, `services/api-gateway/app/stores/workspace_store.py` (`_INFRASTRUCTURE`) |
| Bilingual | Language-parameterized prompts (EN/FR). Translation tool is first-class in the agent tool registry. Non-bilingual tools auto-route through translation. All UI strings externalized to `{en,fr}.json`. | `services/api-gateway/app/tools/translate.py`, `CLAUDE.md` (Hard constraints) |
| Accessibility | WCAG 2.1 AA floor, EN 301 549 target. GC Design System components, keyboard nav, screen reader support, agentic step indicators (screen-reader-announced). | `apps/`, `CLAUDE.md` (UI/UX stack) |
| FinOps | Outcome-based cost attribution. APIM headers propagate cost tags. P53 FinOps Command Center consumes P75 APIs. 41-task WBS from cost model through Power BI dashboards. | `services/api-gateway/app/middleware/apim_simulation.py`, `CLAUDE.md` (Portal 3 -- FinOps) |
| Continuous authorization | NIST 800-53 control evidence auto-collected. Certification report regenerated on each deployment. Red-team suite runs in CI. | `scripts/certify/`, `scripts/red-team/`, `evidence/` |
