# EVA Agentic — Automated ATO Certification

## Overview

The certification script (`run_certification.py`) implements **Phase 3.4: Continuous Authorization Dashboard** and automated evidence collection for the EVA Agentic project's Authority to Operate (ATO) compliance posture.

This script runs all 35 certification checks:
- **25 ITSG-33 controls** (CA-2, CA-7 per NIST RMF)
- **10 EVA-specific design principles**

Output is a machine-readable evidence package for CIO review.

## Usage

### Basic invocation
```bash
python3 scripts/certify/run_certification.py --env staging --output evidence/
```

### With custom project root
```bash
python3 scripts/certify/run_certification.py \
  --env production \
  --project-root /path/to/eva-refactor \
  --output /var/evidence/
```

### Options
- `--env` (default: `staging`) — target environment (staging/production)
- `--output` (default: `evidence/`) — output directory for reports
- `--project-root` (default: `.`) — project root path (for file checks)

## Output

All outputs are written to the `--output` directory:

```
evidence/
├── certification-report.json      # Machine-readable results (all 35 checks)
├── certification-report.md        # Human-readable report
├── itsg33-controls.json           # ITSG-33 controls only
└── eva-principles.json            # EVA principles only
```

### Report structure

**JSON format (certification-report.json):**
```json
{
  "report_id": "cert-1776267228",
  "timestamp": "2026-04-15T15:34:18.235812+00:00",
  "environment": "staging",
  "total_checks": 35,
  "passed": 34,
  "failed": 1,
  "ready_for_ato": false,
  "results": [
    {
      "check_id": 1,
      "control_id": "AC-2",
      "control_name": "Account Management",
      "category": "itsg33",
      "method": "file_check",
      "pass_criteria": "Entra group mapping exists with role resolution",
      "passed": true,
      "evidence": { "entra_provider": true, "group_mapping": true },
      "duration_ms": 2.34,
      "notes": ""
    },
    ...
  ]
}
```

**Markdown report (certification-report.md):**
```
# EVA Agentic — ATO Certification Report

**Result:** ✅ READY FOR ATO (or ❌ NOT READY — gaps remain)

## Summary
| Metric | Value |
| Total checks | 35 |
| Passed | 34 |
| Failed | 1 |

## ITSG-33 Controls
| # | Control | Name | Status |
| 1 | AC-2 | Account Management | ✅ |
...
```

## Check Categories

### ITSG-33 Controls (1-25)

**AC — Access Control (3 checks)**
1. AC-2 — Account Management
2. AC-3 — Access Enforcement
3. AC-6 — Least Privilege

**AU — Audit & Accountability (6 checks)**
4. AU-2 — Audit Events
5. AU-3 — Audit Content
6. AU-4 — Audit Storage
7. AU-6 — Audit Review
8. AU-9 — Audit Protection
9. AU-11 — Audit Retention

**CM — Configuration Management (3 checks)**
10. CM-2 — Baseline Config
11. CM-3 — Change Control
12. CM-6 — Config Settings

**IA — Identification & Authentication (2 checks)**
13. IA-2 — User Identification
14. IA-5 — Authenticator Mgmt

**SC — System Protection (4 checks)**
15. SC-7 — Boundary Protection
16. SC-8 — Transmission Confidentiality
17. SC-12 — Key Management
18. SC-28 — Protection at Rest

**SI — System Integrity (4 checks)**
19. SI-2 — Flaw Remediation
20. SI-3 — Malicious Code Protection
21. SI-4 — System Monitoring
22. SI-10 — Input Validation

**SA — Security Assessment (3 checks)**
23. SA-11 — Dev Security Testing
24. CA-7 — Continuous Monitoring
25. CP-9 — Backup

### EVA Design Principles (26-35)

26. EVA-01 — Confidence Scoring
27. EVA-02 — Explainability
28. EVA-03 — Source Freshness
29. EVA-04 — Graceful Degradation
30. EVA-05 — Behavioral Fingerprint
31. EVA-06 — Feedback Loop
32. EVA-07 — Conflict Resolution
33. EVA-08 — Bilingual Parity
34. EVA-09 — Provenance Chain
35. EVA-10 — PII Protection

## Check Methods

Each check uses one of these methods:

- **file_check** — Verifies file existence and content patterns
- **bicep_check** — Validates IaC Bicep configuration
- **dir_check** — Checks directory structure

All checks perform static analysis. In production (Phase 3.5), checks expand to include:
- Live API calls (e.g., Entra ID token validation)
- Infrastructure queries (e.g., Azure Resource Graph)
- Log analysis (e.g., Application Insights KQL)
- Security scanning (e.g., OWASP Zap, Snyk)

## Exit Codes

- **0** — All 35 checks passed → ready for ATO
- **1** — One or more checks failed → gaps remain

## Integration with ComplianceDashboard.tsx

The **ComplianceDashboard** component (`apps/portal-ops/src/pages/ComplianceDashboard.tsx`) is the **real-time compliance UI**:

- Displays all 35 checks with live status (green/yellow/red)
- Shows KPI cards for control compliance, evidence freshness, security test pass rate
- Overall compliance progress bar
- "Run Certification Script" button (disabled if any checks fail)
- "Export Evidence Package" button (downloads JSON evidence)

This dashboard **IS the SA&A evidence**. The certification script is the **backend that powers it**.

## Compliance References

- **ITSG-33** — Baseline Canadian government security controls
  - CA-2 (Security Assessments) — Continuous monitoring dashboard
  - CA-7 (Continuous Monitoring) — Automated certification checks

- **NIST AI RMF** — Risk management framework for AI
  - Govern, Map, Measure, Manage phases

- **ESDC AI Reference Architecture (AIRA)** — Approved Jan 29, 2025
  - EVA Agentic aligns with AIRA Layer 3 (Agent Orchestrator) requirements

- **EVA Foundation Technical Design** (v0.4, March 2025)
  - Design principles for confidence, explainability, provenance, PII protection

## Adding New Checks

To add a new check:

1. Add a check method to `CertificationRunner`:
   ```python
   def _check_my_control(self) -> CheckResult:
       r = CheckResult(method="file_check", pass_criteria="My control requirement")
       r.passed = self._file_exists("path/to/file")
       r.evidence = {"file_found": r.passed}
       return r
   ```

2. Add to `checks` list in `run_all()`:
   ```python
   (36, "MY-01", "My Control Name", "itsg33", self._check_my_control),
   ```

3. Update `CONTROL_FAMILIES` in `ComplianceDashboard.tsx` to display the new check.

## Local Development

### Requirements
- Python 3.8+
- No external dependencies (stdlib only)

### Testing
```bash
# Test against staging codebase
python3 scripts/certify/run_certification.py --env staging --output /tmp/test-evidence/

# Test against custom project root
python3 scripts/certify/run_certification.py --project-root ~/eva-refactor --output /tmp/test-evidence/

# Verify JSON output
python3 -m json.tool /tmp/test-evidence/certification-report.json | less
```

### Continuous Integration

Typical CI/CD pipeline usage:
```yaml
# .github/workflows/ato-certification.yml
- name: Run ATO Certification
  run: python3 scripts/certify/run_certification.py --env staging --output evidence/

- name: Upload Evidence
  uses: actions/upload-artifact@v3
  with:
    name: ato-evidence
    path: evidence/

- name: Fail if gaps
  if: failure()
  run: exit 1
```

## Roadmap

**Phase 3.4 (current):** Certification script + ComplianceDashboard UI
**Phase 3.5:** Live infrastructure checks (Azure API, Log Analytics queries)
**Phase 3.6:** Automated evidence package signing for CIO review
**Phase 4.0:** Full continuous monitoring with alerting and escalation

## Support

For questions or to report issues:
1. Check the CLAUDE.md project guidance
2. Review Road-to-ATO-n-Continuous-Authorization.md
3. File an issue in the EVA Foundation repository
