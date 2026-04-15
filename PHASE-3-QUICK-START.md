# Phase 3 Automation — Quick Start Guide

**Date**: April 15, 2025  
**Implementation**: Phase 3.1 (Red Teaming) + Phase 3.2 (Backup/Recovery)

---

## What Was Implemented

### Phase 3.1: Red-Teaming Pipeline
- **Script**: `scripts/red-team/run_red_team.py` (349 lines)
- **Workflow**: `.github/workflows/red-team.yml`
- **Documentation**: `scripts/red-team/README.md`
- **Schedule**: Every Monday 6am UTC (automated)
- **Coverage**: 14 attack scenarios (OWASP Top 10 LLM + MITRE ATLAS)

### Phase 3.2: Backup/Recovery Automation
- **Script**: `scripts/backup/test_recovery.py` (292 lines)
- **Workflow**: `.github/workflows/recovery-drill.yml`
- **Documentation**: `scripts/backup/README.md`
- **Schedule**: Every Sunday 7am UTC (automated)
- **Coverage**: 8 recovery readiness tests (CP-9, CP-10)

### Supporting Documentation
- **Implementation Guide**: `AUTOMATION-PHASE-3-IMPLEMENTATION.md` (429 lines)
- **This Quick-Start**: `PHASE-3-QUICK-START.md`

---

## Quick Reference

### Run Red Team Locally

```bash
# Against local API
python scripts/red-team/run_red_team.py \
  --base-url http://localhost:8000 \
  --output evidence/red-team/

# Against staging (with auth)
python scripts/red-team/run_red_team.py \
  --base-url https://eva-agentic-staging.azurewebsites.net \
  --auth-token $(az account get-access-token --query accessToken -o tsv) \
  --output evidence/red-team/
```

**Result**: JSON report at `evidence/red-team/red-team-{timestamp}.json`

### Run Recovery Drill Locally

```bash
# Test staging backup policies (default)
python scripts/backup/test_recovery.py \
  --env staging \
  --output evidence/backup/

# Test production backup policies
python scripts/backup/test_recovery.py \
  --env production \
  --output evidence/backup/
```

**Result**: JSON report at `evidence/backup/recovery-drill-{timestamp}.json`

### View Results

```bash
# List all reports
ls -lh evidence/red-team/
ls -lh evidence/backup/

# Pretty-print a report
cat evidence/red-team/red-team-*.json | python -m json.tool | head -50
```

---

## Files Created

### Executable Scripts

| File | Lines | Purpose |
|------|-------|---------|
| `scripts/red-team/run_red_team.py` | 349 | Run 14 OWASP/MITRE attack scenarios |
| `scripts/backup/test_recovery.py` | 292 | Validate 8 backup/recovery controls |

### GitHub Actions Workflows

| File | Purpose |
|------|---------|
| `.github/workflows/red-team.yml` | Weekly red-team execution (Monday 6am UTC) |
| `.github/workflows/recovery-drill.yml` | Weekly recovery drill (Sunday 7am UTC) |

### Documentation

| File | Lines | Purpose |
|------|-------|---------|
| `scripts/red-team/README.md` | 98 | Red-team operations & scenario guide |
| `scripts/backup/README.md` | 192 | Recovery operations & procedures |
| `AUTOMATION-PHASE-3-IMPLEMENTATION.md` | 429 | Complete implementation guide |
| `PHASE-3-QUICK-START.md` | (this file) | Quick reference |

### Evidence Directories

```
evidence/
├── red-team/        # Red-team JSON reports (90-day retention)
└── backup/          # Recovery drill JSON reports (90-day retention)
```

---

## Attack Scenarios (Phase 3.1)

| ID | Name | Category | Severity |
|---|---|---|---|
| LLM01-001 | Direct instruction override | Prompt Injection | Critical |
| LLM01-002 | Delimiter injection | Prompt Injection | Critical |
| LLM01-003 | Role confusion | Prompt Injection | High |
| LLM01-004 | Indirect injection via context | Prompt Injection | High |
| LLM02-001 | XSS via chat response | Insecure Output | High |
| LLM03-001 | Fabricated citation request | Overreliance | Medium |
| LLM04-001 | Token exhaustion attack | Denial of Service | Medium |
| LLM06-001 | System prompt extraction | Info Disclosure | Critical |
| LLM06-002 | API key extraction | Info Disclosure | Critical |
| LLM06-003 | PII extraction from context | Info Disclosure | Critical |
| RBAC-001 | Workspace boundary crossing | Access Control Bypass | Critical |
| EXFIL-001 | Encode and exfiltrate | Data Exfiltration | Critical |
| SAFETY-001 | Safety system bypass | Safety Override | Critical |

---

## Recovery Tests (Phase 3.2)

| ID | Component | Test | Control |
|---|---|---|---|
| CP9-COSMOS-001 | Cosmos DB | Continuous backup enabled | CP-9 |
| CP9-COSMOS-002 | Cosmos DB | PITR (7-30 day window) available | CP-9 |
| CP9-BLOB-001 | Blob Storage | Versioning enabled | CP-9 |
| CP9-BLOB-002 | Blob Storage | Soft delete (14 days) | CP-9 |
| CP9-BLOB-003 | Blob Storage | Container soft delete (14 days) | CP-9 |
| AU9-IMMUTABLE-001 | Audit Logs | WORM immutability (365 days) | AU-9 |
| CP9-KV-001 | Key Vault | Soft delete (90 days) + purge protection | CP-9 |
| CP9-KV-002 | Key Vault | Purge protection enabled | CP-9 |

---

## Compliance Mapping

### ITSG-33 Controls

- **SA-11** (Developer Security Testing): Red-teaming (Phase 3.1)
- **CA-8** (Penetration Testing): Red-teaming (Phase 3.1)
- **CP-9** (Information System Backup): Recovery drill (Phase 3.2)
- **CP-10** (System Recovery): Recovery drill (Phase 3.2)
- **AU-9** (Protection of Audit Records): WORM immutability test (Phase 3.2)

---

## Automation Schedule

| Day | Time (UTC) | Task | Status |
|-----|-----------|------|--------|
| Sunday | 07:00 | Recovery Drill (staging) | Automated ✓ |
| Monday | 06:00 | Red Team (staging) | Automated ✓ |
| Anytime | Manual | Red Team (local/prod) | On-demand |
| Anytime | Manual | Recovery Drill (prod) | On-demand |

---

## Baseline Results

After initial implementation, both pipelines should show:

### Red Team Report
```
Results: 14/14 defenses held
Failed:  0
```

### Recovery Drill Report
```
Results: 8/8 checks passed
Failed:  0
```

---

## Next Steps (Post-Implementation)

1. **Baseline Run**: Execute both pipelines once to establish baseline PASS
   ```bash
   python scripts/red-team/run_red_team.py --base-url http://localhost:8000 --output evidence/red-team/
   python scripts/backup/test_recovery.py --env staging --output evidence/backup/
   ```

2. **Review Reports**: Validate JSON structure and content
   ```bash
   cat evidence/red-team/red-team-*.json | python -m json.tool
   cat evidence/backup/recovery-drill-*.json | python -m json.tool
   ```

3. **Configure Secrets**: Add `RED_TEAM_AUTH_TOKEN` to GitHub Actions secrets
   ```bash
   gh secret set RED_TEAM_AUTH_TOKEN --body "$(az account get-access-token --query accessToken -o tsv)"
   ```

4. **Verify Workflows**: Confirm GitHub Actions workflows are enabled
   ```bash
   gh workflow list
   ```

5. **Monitor First Run**: Watch Monday morning 6am UTC for first red-team execution

---

## Troubleshooting

### Red Team Script Fails to Connect

**Symptom**: `Connection refused` or `timeout`  
**Solution**:
1. Verify API is running: `curl http://localhost:8000/health`
2. Check URL format: `-base-url` should not have trailing slash
3. For staging: ensure VPN connected and auth token valid

### Recovery Drill Shows Failures

**Symptom**: `CP9-COSMOS-001: FAIL`  
**Solution**:
1. Check Bicep config exists: `ls infra/modules/cosmos/main.bicep`
2. Verify backup policy in Bicep: `grep -i "continuous" infra/modules/cosmos/main.bicep`
3. Run az CLI manually (if authenticated):
   ```bash
   az cosmosdb show --name eva-agentic-staging-cosmos \
     --resource-group rg-eva-agentic-staging \
     --query backupPolicy
   ```

### Missing Dependencies

**Symptom**: `ModuleNotFoundError: No module named 'httpx'`  
**Solution**:
```bash
pip install httpx
```

---

## Full Documentation

For detailed procedures, compliance mappings, and extension guides:

- **Red Teaming**: See `scripts/red-team/README.md`
- **Recovery**: See `scripts/backup/README.md`
- **Complete Implementation**: See `AUTOMATION-PHASE-3-IMPLEMENTATION.md`

---

**Created**: April 15, 2025  
**Total Lines of Code**: 1,450 (scripts + workflows + docs)  
**Compliance Status**: Phase 3 Complete ✓
