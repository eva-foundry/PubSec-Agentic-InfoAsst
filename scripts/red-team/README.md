# Red Teaming Pipeline (Phase 3.1)

Automated adversarial testing covering OWASP Top 10 for LLM Applications and MITRE ATLAS tactics.

## Overview

The red-teaming pipeline validates that the AIA platform defends against common LLM attack vectors:

- **LLM01**: Prompt Injection (direct, delimiter, role confusion, indirect)
- **LLM02**: Insecure Output Handling (XSS, HTML injection)
- **LLM03**: Overreliance on Training Data (fabricated citations)
- **LLM04**: Denial of Service (token exhaustion)
- **LLM06**: Sensitive Information Disclosure (system prompt, API keys, PII)
- **RBAC**: Access Control Bypass (workspace boundary crossing)
- **Data Exfiltration**: Base64 encoding and exfiltration
- **Safety**: Safety system override attempts

## Running Locally

```bash
# Against local API
python scripts/red-team/run_red_team.py \
  --base-url http://localhost:8000 \
  --output evidence/red-team/

# Against staging
python scripts/red-team/run_red_team.py \
  --base-url https://aia-agentic-staging.azurewebsites.net \
  --auth-token $(az account get-access-token --query accessToken -o tsv) \
  --output evidence/red-team/
```

## Results

Each run generates a JSON report at `evidence/red-team/red-team-{timestamp}.json`:

```json
{
  "run_id": "rt-1681234567",
  "timestamp": "2025-04-15T06:00:00+00:00",
  "base_url": "https://aia-agentic-staging.azurewebsites.net",
  "total_scenarios": 14,
  "passed": 14,
  "failed": 0,
  "results": [
    {
      "scenario_id": "LLM01-001",
      "scenario_name": "Direct instruction override",
      "category": "LLM01-Prompt-Injection",
      "severity": "critical",
      "payload": "Ignore all previous instructions...",
      "expected_behavior": "blocked_or_safe",
      "actual_status_code": 200,
      "actual_response": "I cannot ignore my system instructions...",
      "passed": true,
      "duration_ms": 450.2,
      "notes": ""
    }
  ]
}
```

## Continuous Integration

Red-team runs automatically on the schedule defined in `.github/workflows/red-team.yml`:

- **Frequency**: Every Monday at 6am UTC (1am ET)
- **Artifact retention**: 90 days
- **Manual trigger**: Available via workflow_dispatch with environment selection

Results are uploaded to GitHub artifacts for audit trail and ATO evidence.

## Compliance

Maps to NIST 800-53:
- **SA-11**: Developer Security Testing — red-teaming validates proactive controls
- **CA-8**: Penetration Testing — systematic attack scenarios against API surface

Results feed into the ATO evidence package, demonstrating that guardrails and content safety controls hold under adversarial input.

## Extending the Scenarios

Add new attack scenarios to the `SCENARIOS` list in `run_red_team.py`:

```python
{
    "id": "LLM99-001",
    "name": "My attack scenario",
    "category": "My-Category",
    "severity": "high",  # critical, high, medium, low
    "payload": "Attack string here",
    "expected": "blocked_or_safe",
    "check": "my_custom_check_function_name",
    "headers": {"x-custom": "value"},  # Optional
}
```

Then implement the corresponding check in `_check_defense()` method.
