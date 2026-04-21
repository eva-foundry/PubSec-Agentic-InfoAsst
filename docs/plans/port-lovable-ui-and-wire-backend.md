# P53 — Port Lovable UI into portal-unified and wire to the FastAPI backend

## Context

`mind-arch` (`/Users/marco/Documents/eva-foundry/mind-arch`) is the Lovable-generated React app that represents the current design of AIA — three-mode shell (Workspace / Administration / Operations), 15 domain routes, shadcn/ui, i18n, theme customizer, command palette, and a complete set of pages (Chat, Catalog, MyWorkspace, Onboarding, Models, Compliance, RedTeam, Cost, AIOps, Drift, LiveOps, DevOps). It has **zero backend wiring** — every page reads from `src/lib/mock-data.ts`.

P53 (`/Users/marco/Documents/eva-foundry/53-AIA-Refactor`) already contains `apps/portal-unified/`, which is a **near-identical earlier snapshot** of the same Lovable app (diffs limited to `package.json` name, `typecheck` script, one `ThemeCustomizer` type, `textarea.tsx`, `test/setup.ts`). It is also mock-only. Meanwhile, `services/api-gateway` is a complete FastAPI backend covering every page the UI implies — chat (NDJSON streaming with provenance/explainability/agent_step events), documents, workspaces, bookings, teams, surveys, admin (clients, interviews, models, prompts), ops (finops/aiops/liveops/corpus-health/feedback/eval/deployments), citations, system info, demo auth.

The work is therefore two concrete things: (1) overwrite `apps/portal-unified` with current `mind-arch` content while preserving P53 packaging conventions, and (2) replace every `mock-data` import with real API calls against the existing FastAPI routes. Outcome: one frontend, fully live against `services/api-gateway`.

## Critical files

### Frontend (P53, to be rewritten)
- [apps/portal-unified/src/](apps/portal-unified/src/) — full tree replaced from `mind-arch/src/`
- [apps/portal-unified/package.json](apps/portal-unified/package.json) — keep `@aia/portal-unified` name + `typecheck` script, take deps/version from mind-arch
- [apps/portal-unified/vite.config.ts](apps/portal-unified/vite.config.ts) — set port to **5173** (matches backend CORS + Playwright)
- New: `apps/portal-unified/src/lib/api/` — typed API client + React Query hooks (see Phase B)
- New: `apps/portal-unified/src/contexts/AuthContext.tsx` — replaces hardcoded "Jordan Mehta / acme-prod"
- New: `apps/portal-unified/.env.example` — `VITE_API_BASE_URL=http://localhost:8000`

### Backend (P53, mostly unchanged — used as-is)
- [services/api-gateway/app/main.py:34-47](services/api-gateway/app/main.py:34) — CORS allowlist (already has 5173)
- [services/api-gateway/app/routers/](services/api-gateway/app/routers/) — all routers consumed by the frontend
- [services/api-gateway/app/provenance/models.py](services/api-gateway/app/provenance/models.py) — TS types mirror this
- [services/api-gateway/app/models/](services/api-gateway/app/models/) — Pydantic schemas that dictate frontend types
- `playwright.config.ts` — may need `baseURL` flipped to `http://localhost:5173` if currently pointing at 8080

## Phase A — Land Lovable code into apps/portal-unified

**Goal**: `apps/portal-unified` on disk equals `mind-arch/src/` plus a handful of P53-specific overrides.

Steps:
1. **Archive first**: `mv apps/portal-unified apps/.archive/portal-unified-pre-lovable-$(date +%Y%m%d)` — preserve recoverable state.
2. Create `apps/portal-unified/` fresh; copy `mind-arch/{src,public,index.html,components.json,tailwind.config.ts,postcss.config.js,tsconfig*.json,vite.config.ts,eslint.config.js,vitest.config.ts,package.json,bun.lock*}` in.
3. **Override package.json**: restore `"name": "@aia/portal-unified"`, restore `"typecheck": "tsc --noEmit"` script, keep everything else from mind-arch.
4. **Vite dev port → 5173** (backend CORS contract). Edit `vite.config.ts`:
   ```ts
   server: { host: "::", port: 5173 }
   ```
5. **Drop ES locale** (`src/locales/es.json`) and its registration in `src/lib/i18n.ts`. CLAUDE.md mandates EN/FR only; leaving ES violates the bilingual hard constraint and expands translation surface we can't maintain.
6. **Strip `lovable-tagger`** from `vite.config.ts` and `package.json` devDeps. It is dev-only telemetry for Lovable's editor; no value inside P53. Keep everything else from Lovable intact.
7. **Remove the "Edit with Lovable" badge**: any lingering script tag in `index.html` or badge mount in `main.tsx`.
8. Run `npm install` at the repo root (workspaces) to pick up new deps.

**Verification after Phase A**: `npm run dev --workspace @aia/portal-unified` serves the app on `http://localhost:5173` and every route renders against mock-data exactly as `mind-arch.lovable.app` does.

## Phase B — Build the API client layer

**Goal**: a single typed fetch wrapper + per-domain React Query hooks. No page imports `fetch` directly.

New files under `apps/portal-unified/src/lib/api/`:

- `client.ts` — `createApiClient({ baseUrl, getAuthToken })` returning typed `get/post/patch/del` methods. Reads `import.meta.env.VITE_API_BASE_URL` (default `http://localhost:8000`). Adds `x-correlation-id` (uuid v4 per request), threads `Authorization: Bearer <token>`, surfaces backend error envelope as a typed `ApiError`.
- `stream.ts` — `streamNdjson<T>(url, init)` — async iterator over the `POST /v1/aia/chat` NDJSON body using the Fetch + `ReadableStream` + `TextDecoder` pattern, yielding parsed `ChatEvent` discriminated union (`provenance | degradation | content | agent_step | provenance_complete`).
- `types.ts` — TS mirrors of backend models (hand-curated, no codegen for now):
  `Workspace`, `Booking`, `TeamMember`, `EntrySurvey`, `ExitSurvey`, `Client`, `Interview`, `ModelConfig`, `PromptVersion`, `ChatMessage`, `Citation`, `ProvenanceRecord`, `ExplainabilityRecord`, `BehavioralFingerprint`, `ChatEvent`, `ConfidenceFactors`, `AuditEntry`, `FinOpsMetrics`, `AIOpsMetrics`, `LiveOpsMetrics`, `CorpusHealth`, `DeploymentRecord`, `EvalArenaEntry`.
- `hooks/` — one file per backend router, each exporting typed React Query hooks:
  - `useChat.ts` — `useChatStream(request)` driving `streamNdjson`; `useConversations`, `useConversation(id)`, `useSubmitFeedback`, `useSessionCost`, `useCompareChat`.
  - `useWorkspaces.ts` — `useWorkspaces`, `useWorkspace(id)`.
  - `useBookings.ts` — `useBookings`, `useCreateBooking`, `useUpdateBooking`, `useCancelBooking`.
  - `useTeams.ts` — `useTeamMembers(bookingId)`, `useAddMember`, `useChangeRole`, `useRemoveMember`.
  - `useSurveys.ts` — `useSubmitEntrySurvey`, `useSubmitExitSurvey`.
  - `useDocuments.ts` — `useDocumentStatus`, `useUploadDocument`, `useDeleteDocument`, `useResubmitDocument`, `useDocumentContent(id)`.
  - `useAdmin.ts` — clients, interviews, workspaces (provision/decommission), bookings, models (list/toggle/history), prompts (versions/rollback), workspace prompt + valves.
  - `useOps.ts` — health, finops, aiops, liveops, corpus-health, feedback-analytics, evaluation-arena, deployments, traces.
  - `useCitations.ts` — `useCitation(id)`, `useCitationFile(id)`.
  - `useSystem.ts` — `useSystemInfo`, `useProvenance(correlationId)`.
  - `useAuth.ts` — `useDemoLogin`, `useDemoUsers`, `useCurrentUser`.
- `keys.ts` — centralised React Query key factory (`qk.workspaces.list()`, `qk.chat.conversation(id)`, etc.).

`App.tsx` wraps the existing `QueryClientProvider` (already present) with `<AuthProvider>` and `<ApiProvider>` so hooks can read the client from context.

## Phase C — Auth, tenant, and user context

**Goal**: kill the hardcoded "Jordan Mehta / acme-prod" strings and make portal/route access derive from the real user.

Steps:
1. New `src/contexts/AuthContext.tsx` holding `{ user: UserContext | null, token, login, logout }`. On mount, checks `localStorage["aia.auth.v1"]` for a stored demo token; if none, shows `LoginScreen`.
2. New `src/pages/Login.tsx` — minimal form that calls `POST /v1/aia/auth/demo/login`, surfaces demo personas via `GET /v1/aia/auth/demo/users`, persists token + user to localStorage.
3. Replace hardcoded identity in `src/components/SidebarNav.tsx` (footer user chip) and `src/components/Topbar.tsx` with `useAuth()` reads.
4. Gate `PortalSwitcher` tabs by `user.portal_access`: hide Administration / Operations tabs for users without those roles.
5. `AppShell` redirects to `/login` when unauthenticated; public routes (`/`, `/pricing`, `/about`) stay open.
6. API client pulls token from `AuthContext` and attaches `Authorization: Bearer …` plus APIM headers (`x-app-id: portal-unified`, `x-user-group: <user.role>`, `x-classification: <workspace.classification>`).

## Phase D — Wire every page off mock-data

**Goal**: delete `src/lib/mock-data.ts` by the end of this phase.

Page-by-page replacement, in dependency order. Each bullet becomes a small, mergeable commit.

**Workspace portal**
- `pages/Catalog.tsx` — replace `WORKSPACES`/`ARCHETYPES` with `useWorkspaces()` + a new `useArchetypes()` hook. Archetypes are not yet a dedicated endpoint — start by deriving from `GET /v1/aia/workspaces` group-by `archetype` (backend enhancement tracked as follow-up).
- `pages/MyWorkspace.tsx` — wire `useWorkspace(id)`, `useBookings`, `useTeamMembers`, `useDocumentStatus`, document upload, survey submission.
- `pages/Chat.tsx` — the big one. Replace `SCRIPTED_QA_BY_WORKSPACE` and the hand-rolled `AGENTIC_STEPS` animation with `useChatStream`. Mapping of backend events → UI state:
  - `provenance` (first event) → sets `correlationId`, `conversationId`, `messageId` on the message row.
  - `agent_step` (tool = search/cite/rewrite, status = running|complete, duration_ms) → drives the existing "Plan → Retrieve → Reason → Cite → Verify → Respond" indicator; map tools to phases, mark each complete when `status === "complete"`.
  - `content` → append to streamed answer text.
  - `degradation` → show the "Running in partial RAG mode" banner already present in the UI, with `notice_en`/`notice_fr` chosen via i18n.
  - `provenance_complete` → renders confidence badge, sources panel, negative evidence, behavioral fingerprint footer (`model=… · prompt=… · corpus=…`), escalation tier chip.
  - Grounded/Ungrounded toggle maps to `mode` field in request; language selector sends preferred language.
  - "New conversation" posts without `conversation_id`; history sidebar populates via `useConversations()`.

**Admin portal**
- `pages/Onboarding.tsx` — 6-step wizard. Steps 1–2 (org profile, data classification) → `POST /v1/aia/admin/clients`. Step 3 (assurance level) → local state (default applied to future workspace provisioning). Step 4 (workspace templates) → `POST /v1/aia/admin/workspaces/provision` with `dry_run: true` first, confirm, then execute. Step 5 (role mapping) → patch client. Progress persisted via existing localStorage key (`aia-onboarding-progress`) now keyed off real client_id.
- `pages/Models.tsx` — Model Registry tab → `useAdminModels()` + `useToggleModel`; Evaluation Arena tab → `useEvalArena()`; prompt cards → `useAdminPrompts`, Diff via two calls to version history, Rollback via `useRollbackPrompt`; behavioral fingerprint line reads from `useSystemInfo()`.
- `pages/Compliance.tsx` — audit log from `useOps().feedbackAnalytics` + a new `useAuditLog()` hook hitting `/v1/aia/ops/audit` (stub to add — see Phase F), framework chips static (compliance frameworks are configuration, not runtime data).
- `pages/RedTeam.tsx` — `useEvalArena()` for baseline table. Adversarial test runner is the one real gap: UI action calls a new `POST /v1/aia/ops/eval/challenges` endpoint that doesn't exist yet → keep current mock for now, flag as Phase F.

**Ops portal**
- `pages/Cost.tsx` — KPI cards + charts from `useFinOpsMetrics({ days: 30 })`. MTD/forecast/waste-score/chargeback-coverage map to `total_cost_cad`, `forecast_cad` (add if missing), `waste_score`, and a computed coverage %.
- `pages/AIOps.tsx` — `useAIOpsMetrics()` — confidence/groundedness/calibration/escalation.
- `pages/Drift.tsx` — `useAIOpsMetrics()` + `useDeployments()` for now; dedicated drift endpoint is a Phase F follow-up.
- `pages/LiveOps.tsx` — `useLiveOpsMetrics()` + `useOpsHealth()` for service grid.
- `pages/DevOps.tsx` — `useDeployments()` for history; rollback button wired to a new `POST /v1/aia/admin/deployments/{version}/rollback` (Phase F follow-up, keep disabled with tooltip until endpoint exists).

**Cross-cutting**
- `contexts/ThemeCustomizer.tsx` — no backend change; the `assurance`/`portal`/`lang` selections stay client-side but are forwarded on each API call so backend can enforce policy. Add `x-assurance-level` header from the customizer to every request via the API client interceptor.
- Delete `src/lib/mock-data.ts` once every page is migrated. This is the acceptance criterion for Phase D completion.

## Phase E — Chat streaming correctness

Single file deserving its own phase because it defines the product. `src/lib/api/stream.ts` must:

- Use `fetch` with `{ method: "POST", body: JSON.stringify(req), headers: { "Content-Type": "application/json", Accept: "application/x-ndjson", ... } }`.
- Read `response.body!.getReader()`, decode via `TextDecoder("utf-8")`, split on `\n`, JSON-parse each non-empty line.
- Expose an `AsyncIterable<ChatEvent>` so `useChatStream` can `for await (const ev of stream) …`.
- Handle mid-stream abort via `AbortController` (user navigating away, clicking "New conversation" mid-answer).
- On network failure, surface a `degradation` synthetic event so the UI degradation banner stays the single source of truth for failure display.

Backend fixtures already exist (`services/api-gateway/tests/…`) — use those to build a deterministic MSW handler in `src/test/msw/chat.ts` for unit tests.

## Phase F — Backend gaps flagged during wiring (tracked, not done in this plan)

These surface from Phase D. Capture as GitHub issues; do not block the port.

- `GET /v1/aia/ops/audit` — typed audit log for Compliance page (today audit events are embedded elsewhere).
- `POST /v1/aia/ops/eval/challenges`, `GET /v1/aia/ops/eval/results` — Red Team adversarial test runner.
- `GET /v1/aia/ops/metrics/drift` — dedicated drift signals (model, prompt, corpus) for Drift page.
- `POST /v1/aia/admin/deployments/{version}/rollback` — DevOps rollback action.
- Archetypes endpoint or explicit `archetype` field normalisation in workspaces response.
- `forecast_cad` and explicit `waste_score` on the finops response if not already present.

## Verification

End-to-end, run in three terminals from `/Users/marco/Documents/eva-foundry/53-AIA-Refactor`:

```bash
# Terminal 1 — backend + tooling
make dev                           # brings up azurite, jaeger, api-gateway on :8000

# Terminal 2 — frontend
npm run dev --workspace @aia/portal-unified   # serves on :5173

# Terminal 3 — verification
npm run typecheck --workspaces
npm run lint --workspaces
npm run test --workspace @aia/portal-unified   # vitest incl. jest-axe a11y
pytest services/api-gateway                    # ensure no backend regressions
npx playwright test                            # e2e against live stack
```

Manual smoke test (flip `EVA_DEBUG=true` on the backend):
1. `/login` — pick demo persona "Ops Admin", confirm user chip shows real identity.
2. `/chat` — select "Internal HR Handbook", ask the prefilled question, confirm:
   - Agent-step indicator progresses through Plan → Retrieve → Reason → Cite → Verify → Respond driven by real `agent_step` events (check network tab for NDJSON body).
   - Sources panel populates with real citation metadata (`GET /v1/aia/citations/{id}` in the waterfall).
   - Confidence badge, behavioural fingerprint line, explainability text present in the final message.
3. `/models` — toggle a model off; confirm `PATCH /v1/aia/admin/models/{id}/toggle` fires; reload and persistence holds.
4. `/cost` — KPIs and chart render from `GET /v1/aia/ops/metrics/finops`.
5. `/onboarding` — complete steps 1 and 2, reload; progress resumes against the real client record.
6. Cross-check `grep -r "mock-data" apps/portal-unified/src` returns zero hits.

Regression guard: `pytest services/api-gateway/tests/test_orchestrator_stream.py` (the file behind the recent `provenance_complete` commits) must stay green — the UI mapping in Phase E depends on its event shape contract.

## Out of scope

- Porting to GCDS components (enterprise design system) — tracked as follow-up per CLAUDE.md UI stack decision.
- Entra ID OAuth flow — demo auth only in this plan; production auth is a separate effort.
- APIM real instance — `APIMSimulationMiddleware` continues to stand in.
- Infra Bicep changes — no container image or APIM product changes required since backend surface is unchanged.
- Dropping the `mind-arch` source repo — left in place; treat P53 `apps/portal-unified` as the new home, and future Lovable regenerations re-land via Phase A only.
