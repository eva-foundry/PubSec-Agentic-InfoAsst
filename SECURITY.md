# Security

AIA is proposed as an evolution of Microsoft's [Information Assistant agent template](https://github.com/microsoft/PubSec-Info-Assistant). Security reporting follows the upstream repository's posture.

## Reporting security issues

**Please do not report security vulnerabilities through public GitHub issues.**

Until AIA is accepted upstream, report vulnerabilities privately by opening a GitHub Security Advisory on this repository. Once merged, reports should follow the upstream Microsoft Security Response Center (MSRC) process at [https://msrc.microsoft.com/create-report](https://msrc.microsoft.com/create-report) or via email to [secure@microsoft.com](mailto:secure@microsoft.com).

Please include the following information (as much as you can provide) to help us triage the issue:

- Type of issue (e.g. buffer overflow, SQL injection, cross-site scripting, prompt injection, authorization bypass, etc.)
- Full paths of source file(s) related to the manifestation of the issue
- The location of the affected source code (tag/branch/commit or direct URL)
- Any special configuration required to reproduce the issue
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the issue, including how an attacker might exploit it

## Agentic-assistant specific concerns

Because AIA is a multi-step agentic assistant, the following classes of issue are in scope:

- Prompt injection that causes an agent to leak tools, system prompts, or cross-workspace data
- Authorization bypass across workspace / RBAC boundaries
- PII leakage through citations, audit logs, or telemetry
- Adversarial inputs that defeat content-safety or grounding guardrails
- Tool-registry abuse (calling an unauthorized tool via planner-level injection)

## Providing non-security feedback

For non-security issues, please use the [Contributing guidelines](./CONTRIBUTING.md).
