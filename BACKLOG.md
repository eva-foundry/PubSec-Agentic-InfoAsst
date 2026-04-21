# AIA Backlog

Open work tracked against the upstream-PR path. Items are grouped by theme and flagged by status:

- **🟢 Ready** — scoped, no blockers, can be picked up immediately
- **🟡 In flight** — work started on a branch, not yet merged
- **🟠 Blocked / needs decision** — waiting on an answer or dependency
- **🔵 Parked** — deliberately deferred, notes on why

> This file is the canonical place for AIA open work. Individual topic branches (e.g. `claude/phase-a-wiring-gaps`, `claude/red-team-runner`) capture exploratory implementations; this backlog is the source of truth for what still needs to land before the upstream PR.

---

## 1. Opensource-prep residue

### 🟢 Replace `eva-foundry` GitHub org references
Seven files still contain `eva-foundry` as the repo host (CI workflows, bicep params, runbooks, a plan doc). These references become obsolete the moment the repo moves under the upstream Microsoft organization, but while AIA lives on `github.com/eva-foundry/53-AIA-Refactor` they're factually correct. Plan: leave until the upstream PR is opened, then swap to the final upstream path in one commit.

Files: `.github/workflows/*.yml`, `infra/environments/{prod,staging}.bicepparam`, `infra/main.bicep`, `infra/modules/container-apps/main.bicep`, `docs/azure-e2e-{log,runbook}.md`, `docs/plans/port-lovable-ui-and-wire-backend.md`.

### 🟠 Scrub Canadian tribunal / court acronyms (SST, FCA, SCC)
The source-authority classifier ([services/api-gateway/app/tools/classify.py](services/api-gateway/app/tools/classify.py), [guardrails/conflict.py](services/api-gateway/app/guardrails/conflict.py)) and its seed data reference `SST` (Social Security Tribunal), `FCA` (Federal Court of Appeal), and `SCC` (Supreme Court of Canada) as concrete examples of multi-jurisdictional legal sources. The logic itself is a legitimate feature — demonstrating tribunal-aware source authority ranking — but the specific acronyms telegraph a single jurisdiction.

Decision needed: (a) keep as a demo of multi-jurisdictional ranking with a README note that acronyms are examples, (b) genericise to `TribunalA / TribunalB / SupremeCourt` across classifier + seed + tests, or (c) replace with US-equivalent examples (`BIA`, `CAFC`, `SCOTUS`) for broader recognition in the upstream audience.

### 🟢 Generic opensource-friendly sample corpus
[data/sample-documents/](data/sample-documents/) is empty (bring-your-own). For the upstream PR to demonstrate end-to-end functionality, a small generic corpus (5–10 public-domain docs) should ship. Candidates: a few RFCs, a handful of Wikipedia articles on a narrow topic, or a curated set of permissive-licence policy documents.

**Blocks 3 tests**: removing the country-specific sample docs broke three assertions in [services/api-gateway/tests/test_documents_list.py](services/api-gateway/tests/test_documents_list.py) (`test_returns_documents_for_admin`, `test_workspace_filter`, `test_limit_caps_results`) that depend on the preload pipeline finding those fixtures on disk. When the generic corpus lands, either update [services/api-gateway/app/pipeline/preload.py](services/api-gateway/app/pipeline/preload.py) `WORKSPACE_DOCS` to reference the new filenames, or rewrite the tests to use synthetic fixtures independent of the on-disk corpus.

### 🟢 Directory + repo rename to match the `AIA` identity
On-disk path is still `53-EVA-Refactor/`; repo is `eva-foundry/53-EVA-Refactor`. Rename to `AIA/` (or similar) before the upstream PR. Cosmetic only — does not affect code.

---

## 2. End-to-end evidence for the upstream PR

### 🟡 Playwright-driven end-to-end screenshots
Capture a scripted walkthrough of the full user journey (landing → login → upload → chat with citations → admin console → ops/FinOps → RBAC) into [docs/screenshots/](docs/screenshots/) and reference from the top of [README.md](README.md). Target: one screenshot per major route, captioned, no PII, against synthetic data only. Leverage the existing [playwright.config.ts](playwright.config.ts).

### 🟢 Demo data + fixture rationalisation
Current demo seed data lives in a handful of places (MSW fixtures, backend seed scripts, i18n sample strings). Consolidate into one documented path so reviewers can follow "here's what data the screenshots were captured against."

### 🟢 Upstream-PR description draft
Separate doc (`docs/upstream-pr.md`) that frames AIA as a refactor of the Information Assistant template implementing the concepts of *The Agentic State*. Should include: the rationale (why agentic vs. one-shot RAG), the delta from the current template (agentic planner, tool registry, Responsible-AI gates, multi-language, FinOps attribution), and the screenshot walkthrough.

---

## 3. In-flight work on topic branches

Each of these is a `claude/*` branch with work started but not merged. Triage decision required for each: merge, discard, or promote to `main` with rebase.

| Branch | Theme | Likely disposition |
|---|---|---|
| `claude/phase-a-wiring-gaps` | Backend wiring completeness audit | Review + merge if tests pass |
| `claude/phase-b-cosmos-variants` | Cosmos schema variants | Review — may be superseded |
| `claude/phase-c-azure-compute` | Azure compute wiring | Review + merge |
| `claude/phase-d-cicd-e2e` | CI/CD end-to-end hardening | Review + merge |
| `claude/phase-e-apim-headers` | APIM header propagation | Review + merge |
| `claude/phase-f-runbook` | Operations runbook | Review + merge |
| `claude/phase-g-demo-gaps` | Demo-scenario gap closure (current branch base) | Merge as part of opensource-prep |
| `claude/archetypes-catalog` | Solution-archetype catalog | Review — domain-specific |
| `claude/audit-log` | Audit log hardening | Review + merge |
| `claude/deployment-rollback` | Rollback flow | Review + merge |
| `claude/documents-and-ops-timeseries` | Document / ops time-series telemetry | Review + merge |
| `claude/drift-metrics` | Corpus drift metrics | Review + merge |
| `claude/finops-enrichment` | FinOps enrichment | Review + merge |
| `claude/red-team-runner` | Red-team harness | Review + merge |
| `claude/tier4-msw` | Tier-4 MSW fixtures | Review + merge |
| `claude/toggle-model-body` | Model toggle request-body shape | Review + merge |
| `claude/magical-galileo` | Unclear theme — needs inspection | Inspect first |

Plan: once opensource-prep is merged and the history is squashed for the upstream PR, these topic branches become orphan references to pre-squash history. Decide before the squash which are still valuable and cherry-pick their substance onto the clean trunk.

---

## 4. Active design work with a committed plan

### 🟡 Port Lovable UI into portal-unified and wire to FastAPI backend
Full plan at [docs/plans/port-lovable-ui-and-wire-backend.md](docs/plans/port-lovable-ui-and-wire-backend.md). Multi-phase (A–G) work to overwrite `apps/portal-unified/` with the current `mind-arch` Lovable output and replace every mock-data import with real API calls against `services/api-gateway`. Status: plan exists, implementation in phases across the `claude/phase-*` branches above.

---

## 5. Architecture principles awaiting implementation

Derived from [AIA-Design-Principles-Beyond-Agentic-State.md](AIA-Design-Principles-Beyond-Agentic-State.md). These are architectural dimensions the paper doesn't cover but AIA should demonstrate as a refactor of the Information Assistant template:

- **Confidence scoring** — connective tissue between autonomous operation and responsible disclosure. Escalation tiers without it are arbitrary.
- **Explainability beyond citations** — users should know why case X was surfaced and case Y wasn't.
- **Source freshness as a first-class retrieval dimension** — not an afterthought.
- **Graceful degradation** — partial-answer-with-disclosure when a source collection is unreachable.
- **Conflict resolution** — when two agents give different answers over overlapping corpora, present the conflict with attribution.
- **Feedback loop** — every subject-matter-expert correction is a training signal; capture it.
- **Version control + rollback** — shared-core changes should be rollback-able per solution space.
- **Smart assistance** — meet users where they are (literacy, language, digital fluency).
- **Cost-of-errors-aware testing** — test at the stakes of the use case, not just coverage.

Each of these maps to a concrete implementation slice that belongs in this backlog as a named item once the owner is identified.

---

## 6. Known small follow-ups

- [ ] Update `docs/index.html` top matter to reflect the `AIA` name in page titles and meta tags (bulk scrub caught the content but metadata may still say `EVA`).
- [ ] Verify `services/api-gateway` and `apps/portal-unified` typechecks + tests are green after the bulk scrub (pending verification pass in opensource-prep).
- [ ] Audit `infra/` Bicep parameters for any remaining `rg-eva-agentic-*` references (bulk scrub already renamed to `rg-aia-agentic-*` but confirm).
- [ ] Decide whether `Agentic-State-Vision.md` and `AIA-Design-Principles-Beyond-Agentic-State.md` stay at repo root or move into `docs/design/`.
- [ ] Stand up a GitHub Actions workflow for doc-lint and a dead-link checker before opening the upstream PR.

---

## How to update this file

- Add a new section under the right theme when a new piece of work appears.
- Flip status flags as items progress; do not delete completed items — move them into `CHANGELOG.md` under *Unreleased* with a brief summary, then they can be removed from here.
- Keep the top-five most-ready items rank-ordered at the top of section 1 so a reviewer can always find the "what should I pick up next?" answer in under ten seconds.
