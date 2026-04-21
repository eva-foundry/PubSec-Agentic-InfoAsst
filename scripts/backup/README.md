# Backup & Recovery Automation (Phase 3.2)

Automated validation of backup policies and point-in-time recovery readiness across all data tiers.

## Overview

The recovery drill validates that data persistence controls meet NIST 800-53 CP-9 and CP-10 requirements:

- **CP-9**: Information System Backup
  - Cosmos DB continuous backup with point-in-time restore (PITR)
  - Blob storage versioning (all versions retained)
  - Blob soft delete (14-day retention)
  - Container soft delete (14-day retention)

- **CP-10**: System Recovery
  - Key Vault soft delete (90-day retention) + purge protection
  - Audit storage WORM immutability (365-day retention, irreversible)

## Running Locally

```bash
# Against staging environment (default)
python scripts/backup/test_recovery.py --env staging

# Against production
python scripts/backup/test_recovery.py --env production --output evidence/backup/

# Inspect Bicep configs (no Azure CLI required)
python scripts/backup/test_recovery.py --env staging --output evidence/backup/
```

## Results

Each drill generates a JSON report at `evidence/backup/recovery-drill-{timestamp}.json`:

```json
{
  "drill_id": "rd-1681234567",
  "timestamp": "2025-04-15T07:00:00+00:00",
  "environment": "staging",
  "total_tests": 8,
  "passed": 8,
  "failed": 0,
  "results": [
    {
      "test_id": "CP9-COSMOS-001",
      "test_name": "Cosmos DB continuous backup enabled",
      "component": "cosmos",
      "passed": true,
      "duration_ms": 125.3,
      "evidence": {
        "type": "Continuous",
        "continuousTierInDays": 7
      },
      "notes": ""
    }
  ]
}
```

## Continuous Integration

Recovery drills run automatically on the schedule defined in `.github/workflows/recovery-drill.yml`:

- **Frequency**: Every Sunday at 7am UTC (2am ET)
- **Artifact retention**: 90 days
- **Environments**: Staging (default) or Production (manual trigger)
- **Failure notifications**: Workflow fails if any check does not pass

Results are uploaded to GitHub artifacts for audit trail and ATO evidence.

## Test Coverage

### Cosmos DB (HITL Memory, Agent State, Vector Embeddings)

| Test | NIST 800-53 | Check |
|------|---------|-------|
| CP9-COSMOS-001 | CP-9 | Continuous backup enabled |
| CP9-COSMOS-002 | CP-9 | PITR available (7 or 30-day window) |

**Recovery**: Point-in-time restore to any timestamp within the window via Azure portal or CLI.

### Blob Storage (Documents, Indexes, Artifacts)

| Test | NIST 800-53 | Check |
|------|---------|-------|
| CP9-BLOB-001 | CP-9 | Versioning enabled (all versions kept) |
| CP9-BLOB-002 | CP-9 | Soft delete enabled (14 days) |
| CP9-BLOB-003 | CP-9 | Container soft delete enabled (14 days) |

**Recovery**: Restore individual blob versions via `az storage blob show-versions` or restore entire containers from soft delete within 14 days.

### Audit Storage (Log Analytics Exports)

| Test | NIST 800-53 | Check |
|------|---------|-------|
| AU9-IMMUTABLE-001 | AU-9 | WORM immutability (365 days, irreversible) |

**Recovery**: Audit logs cannot be modified or deleted for 365 days. Enables forensics and regulatory evidence. Manual restore not applicable — immutability is the control.

### Key Vault (Master Keys, Connection Strings)

| Test | NIST 800-53 | Check |
|------|---------|-------|
| CP9-KV-001 | CP-9 | Soft delete enabled (90 days) |
| CP9-KV-002 | CP-9 | Purge protection enabled |

**Recovery**: Restore accidentally deleted keys/secrets within 90 days via `az keyvault key recover` or `az keyvault secret recover`. Purge protection prevents permanent deletion.

## Compliance Mapping

- **CP-9**: Backup of all information system components (NIST 800-53 §5.10)
- **CP-10**: System recovery procedures (NIST 800-53 §5.11)
- **AU-9**: Protection of audit records (NIST 800-53 §5.4.8)

Evidence reports feed into:
- Business Continuity Plan (BCP) validation
- Disaster Recovery Plan (DRP) readiness
- ATO audit trail (Continuous Authorization)

## Manual Recovery Procedures

### Cosmos DB Point-in-Time Restore

```bash
# List restore-able timestamps (past 7 days)
az cosmosdb restorable-database-account list \
  --location canadacentral \
  --query "[].restorableLocations[0].creationTime"

# Restore to specific timestamp
az cosmosdb restore \
  --target-resource-group rg-eva-agentic-prod \
  --target-name eva-cosmos-restored \
  --source-account eva-cosmos-prod \
  --restore-timestamp 2025-04-14T12:00:00Z
```

### Blob Storage Version Recovery

```bash
# List versions of a blob
az storage blob show-versions \
  --container eva-documents \
  --name myfile.pdf \
  --account-name storageevaagenticprod

# Restore specific version
az storage blob copy start \
  --source-uri https://storageevaagenticprod.blob.core.windows.net/eva-documents/myfile.pdf?versionid=OLD_VERSION_ID \
  --destination-container eva-documents \
  --destination-blob myfile.pdf.restored
```

### Key Vault Secret Recovery

```bash
# List recently deleted keys/secrets
az keyvault key list-deleted --vault-name eva-keyvault-prod
az keyvault secret list-deleted --vault-name eva-keyvault-prod

# Recover a deleted secret
az keyvault secret recover --vault-name eva-keyvault-prod --name my-secret
```

## Compliance Notes

- **sensitive**: All backup data remains in Canada Central/East (no cross-region redundancy to comply with data residency)
- **Immutability**: Audit logs are write-once, read-many (WORM) — prevents tampering
- **Encryption at rest**: All backups encrypted with customer-managed keys in Key Vault
- **Retention**: Backup windows (7 days PITR, 14 days soft delete, 90 days Key Vault) meet compliance retention minimums

## Extending Tests

Add new recovery tests to the `RecoveryDrill` class in `test_recovery.py`:

```python
def _test_new_component(self) -> RecoveryTestResult:
    """Verify new backup control."""
    result = RecoveryTestResult(
        test_id="CP9-NEW-001",
        test_name="My new recovery test",
        component="new_component",
    )
    start = time.monotonic()
    # Validation logic here
    result.passed = True
    result.duration_ms = (time.monotonic() - start) * 1000
    return result
```

Then add to `run_all()` tests list.
