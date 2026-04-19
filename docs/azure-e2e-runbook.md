# Azure E2E runbook

End-to-end procedure to take the stack from "merged to main" → "running in
Canada Central with 11/11 per-feature Playwright tests green".

Phases A–E shipped the code. This runbook drives Phase F — the actual live
deployment + E2E run. Nothing here requires new code changes; it's pure
operator workflow.

---

## 0. Prerequisites (one-time)

Required Azure subscription access (MarcoSub sandbox):
- Contributor on the `rg-eva-agentic-staging` resource group.
- Ability to create a service principal + grant Contributor scoped to that RG.

GitHub repo access:
- Admin on `eva-foundry/53-EVA-Refactor` (to set secrets + GH Environments).

Local CLI: `az`, `gh`, `jq`.

---

## 1. Create the resource group(s)

```bash
az group create --name rg-eva-agentic-staging --location canadacentral
# Optional (production tier):
az group create --name rg-eva-agentic-prod --location canadacentral
```

---

## 2. Service principal for CI → Azure

```bash
SP_JSON=$(az ad sp create-for-rbac \
  --name eva-agentic-deployer-staging \
  --role Contributor \
  --scopes /subscriptions/$(az account show --query id -o tsv)/resourceGroups/rg-eva-agentic-staging \
  --sdk-auth)
echo "$SP_JSON"
```

Copy the full JSON blob into GitHub:

```bash
gh secret set AZURE_CREDENTIALS_STAGING --body "$SP_JSON"
```

Repeat for production if you want the prod path live too
(`AZURE_CREDENTIALS_PROD`).

---

## 3. Create the two GitHub Environments

```bash
gh api repos/eva-foundry/53-EVA-Refactor/environments/staging -X PUT
gh api repos/eva-foundry/53-EVA-Refactor/environments/production -X PUT
```

In the GitHub UI, add **protection rules** to the `production` environment:
- Require 2 reviewers.
- Restrict to `main` branch.

---

## 4. First Bicep deploy (staging)

The deploy workflow runs this itself on trigger, but you can smoke-test locally
before kicking off CI:

```bash
az deployment group what-if \
  --resource-group rg-eva-agentic-staging \
  --template-file infra/main.bicep \
  --parameters infra/environments/staging.bicepparam
```

Expect: storage, Cosmos, diagnostics, key vault, identities, static web app,
container app environment + api-gateway container app. APIM is registered
on the existing P75 `msub-eva-vnext-apim` instance.

---

## 5. Get the Static Web App deployment token

After the first successful Bicep deploy, grab the SWA API token and store it:

```bash
SWA_TOKEN=$(az staticwebapp secrets list \
  --name eva-portal-staging \
  --resource-group rg-eva-agentic-staging \
  --query properties.apiKey -o tsv)
gh secret set AZURE_STATIC_WEB_APPS_API_TOKEN_STAGING --body "$SWA_TOKEN"
```

---

## 6. Kick off the deploy workflow

```bash
gh workflow run Deploy -f environment=staging
gh run watch
```

The workflow does, in order:
1. `build-image` — docker build + push `ghcr.io/<owner>/eva-api-gateway:<sha>` to GHCR.
2. `deploy-staging/Deploy infrastructure` — `az deployment group create` with the built image.
3. **Capture deployment outputs** — `apiGatewayFqdn`, `swaOrigin`, `apiGatewayName`, `swaName`.
4. **Roll Container App** — `az containerapp update --image ...` to pick up the new build.
5. **Build SPA** with `VITE_API_BASE_URL=https://<apiGatewayFqdn>` injected.
6. **Deploy SPA** via `Azure/static-web-apps-deploy@v1`.
7. **Smoke tests** — 4 `pytest` assertions at `tests/smoke/test_smoke.py` against the API FQDN.
8. **Per-feature E2E** — 11 Playwright tests at `tests/e2e/per-feature.spec.ts` against the SWA origin.

Target runtime: ~12 min cold, ~6 min warm.

---

## 7. Manual verification pass

After the workflow succeeds, click through the live staging URL as each
persona to confirm portal-scoping works:

| Persona | Email | Expected portals |
|---|---|---|
| Alice | `alice@demo.gc.ca` | self-service |
| Bob | `bob@demo.gc.ca` | self-service |
| Carol | `carol@demo.gc.ca` | self-service, admin |
| Dave | `dave@demo.gc.ca` | self-service, admin, **ops** |
| Eve | `eve@demo.gc.ca` | self-service |

Hit every wired route once as Dave: Chat, Catalog, MyWorkspace, Compliance,
Cost, AIOps, Drift, LiveOps, DevOps, Models, RedTeam. Confirm real data
(not skeletons or empty states) — the per-feature Playwright spec already
does this in CI, this is the belt-and-suspenders manual check.

---

## 8. Capture the run artifact

Append the following to `docs/azure-e2e-log.md` (create if it doesn't exist):

```markdown
## Run <YYYY-MM-DD>
- Commit: <sha>
- Image: ghcr.io/eva-foundry/eva-api-gateway:<sha>
- Workflow: https://github.com/eva-foundry/53-EVA-Refactor/actions/runs/<id>
- API: https://<apiGatewayFqdn>
- SWA: https://<swaOrigin>
- Smoke: 4/4 pass
- Per-feature E2E: 11/11 pass
- Notes: <anything surprising>
```

---

## 9. Production promotion (when ready)

```bash
gh workflow run Deploy -f environment=production
```

Will gate on:
- `verify-ci` — CI green on the commit.
- `build-image` — same image reused from staging run (by SHA).
- `deploy-staging` — previous staging run must have completed.
- GitHub Environment `production` — 2 reviewers approve.

---

## Known deferred work

Tracked for Phase H (beyond this plan):
- **Real Entra SSO** — currently demo auth (`x-demo-user-email` header). Needs
  Entra app registration in MarcoSub tenant + `MSAL` in the SPA + backend
  flip from `auth_mode=demo` to `production`.
- **APIM-in-front** — today the Container App is direct-to-public. The
  `apim-product` module already registers the product on P75's APIM; the
  remaining work is pointing the SPA's `VITE_API_BASE_URL` at the APIM
  edge and wiring the APIM backend definition to the Container App FQDN.
- **ACR with private endpoint** — first pass uses public GHCR. Swap when
  compliance requires images to stay inside the VNet.
- **Doc-pipeline + enrichment Container Apps** — stubbed in the Bicep
  module but not yet built as images.
