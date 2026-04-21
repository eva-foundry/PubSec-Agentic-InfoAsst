# Azure E2E run log

Append one block per staging/production deployment. Procedure in
[`azure-e2e-runbook.md`](./azure-e2e-runbook.md).

---

## Run 2026-04-19
- Commit: a3bac32 (branch `claude/phase-g-demo-gaps`)
- Image: `msubsandacr202603031449.azurecr.io/aia-api-gateway:phase-g`
- RG: `AIA-Sandbox-dev` (Canada Central) — reused existing chassis
- API: https://aia-agentic-api.victoriousgrass-30debbd3.canadacentral.azurecontainerapps.io
- SWA: https://proud-pond-09ec5e30f.7.azurestaticapps.net
- Smoke: 5/5 pass
- Per-feature E2E: 11/11 pass
- Notes:
  - First deploy bypassed the Bicep `infra/main.bicep` template and was
    driven by `az containerapp create` against the pre-existing chassis
    (AOAI `msub-aia-dev-openai`, Cosmos `msub-sandbox-cosmos-free`,
    ACR `msubsandacr202603031449`, env `msub-sandbox-env`). Avoided
    duplicating Cosmos/SWA already present in MarcoSub.
  - AOAI had `disableLocalAuth=true` so the Container App runs with a
    system-assigned managed identity + `Cognitive Services OpenAI User`
    role on the AOAI account. No API key stored in env or KV.
  - Cosmos and AI Search keys are passed via Container App secrets
    (`cosmos-key`, `search-key`) — KV references not wired yet.
  - First boot seeded workspaces + bookings + model-registry + telemetry
    but **not** archetypes/deployments/audit (a prior partial seed
    completed the earlier containers and aborted). Manually re-ran
    `_seed_archetypes` + `_seed_deployments` from a local venv against
    live Cosmos; `/v1/aia/archetypes` then returned all 5.
  - Per-feature spec brittleness: original assertions hit strict-mode
    violations on Drift (3 `<h2>` + 1 `<h1>`) and a non-existent heading
    on Chat. Fixed with `.first()` + looser matchers — no product
    changes.

---

<!-- Template:

## Run <YYYY-MM-DD>
- Commit: <sha>
- Image: ghcr.io/eva-foundry/aia-api-gateway:<sha>
- Workflow: https://github.com/eva-foundry/53-AIA-Refactor/actions/runs/<id>
- API: https://<apiGatewayFqdn>
- SWA: https://<swaOrigin>
- Smoke: 4/4 pass
- Per-feature E2E: 11/11 pass
- Notes: <anything surprising>

-->
