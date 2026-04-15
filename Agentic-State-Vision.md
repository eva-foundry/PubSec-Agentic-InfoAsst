# Agentic State Vision — Design Notes for EVA Alignment

**Date:** 2026-04-14  
**Source:** *The Agentic State: Rethinking Government for the Era of Agentic AI* — Luukas Ilves, Manuel Kilian, Simone Maria Parazzoli, Tiago C. Peixoto, Ott Velsberg (Tallinn Digital Summit, 2025)  
**Paper:** https://agenticstate.org/paper.html

---

## Why This Matters

The Agentic State paper is the first comprehensive framework for how agentic AI transforms government operations. It was developed by 20+ digital government leaders from 15 countries and is backed by the World Bank and Global Government Technology Centre Berlin. Its 12-layer model maps directly to how EVA should evolve — it validates our current architecture and flags concrete gaps.

---

## The 12-Layer Model (Quick Reference)

### Implementation Layers (where agents deliver value)

1. **Public Service Design** — Proactive, personalized services that anticipate citizen needs instead of waiting for applications.
2. **Government Workflows** — Self-orchestrating processes across agencies; no manual hand-offs.
3. **Policy-Making** — Continuous, evidence-based policy adaptation (not periodic review cycles).
4. **Regulatory Compliance** — Real-time "compliance-as-code" — regulations become executable logic that agents enforce uniformly.
5. **Crisis Response** — Machine-speed coordination across agencies and jurisdictions.
6. **Procurement** — Autonomous negotiation within defined policy constraints.

### Enablement Layers (structural prerequisites)

7. **Agent Governance** — Accountability frameworks, redress mechanisms, defined authority boundaries.
8. **Data Management & Privacy** — Data minimization, purpose limitation, privacy-by-design.
9. **Technical Infrastructure** — Cloud, data exchanges, digital identity, interoperability.
10. **Cybersecurity** — Security architectures designed for autonomous systems (not bolted on).
11. **Public Finance** — Variable, outcome-based cost models (not fixed project budgets).
12. **People & Culture** — Organizational cultures for human-AI collaboration; new skill sets.

---

## Key Design Principles for EVA

These are the design tenets I should apply when refactoring or extending EVA solutions:

### 1. Proactive over Reactive
Design agents that identify who needs what and when — push-based, not pull-based. EVA Chat is reactive today; the refactor should explore anticipatory workflows and notification-driven assistance.

### 2. Compliance-as-Code
Encode TBS Generative AI guidance, ESDC policies, PIA constraints, and security requirements as executable rules — not just documentation. Agents should enforce these uniformly at runtime without manual checks.

### 3. Human Escalation Architecture
Move from blanket human-in-the-loop to tiered escalation: auto-resolve → flagged-for-review → requires-human-decision. Define clear thresholds for each tier based on risk, sensitivity, and confidence level.

### 4. Privacy-by-Design with Data Minimization
Agents access only what they need, for the stated purpose, with purpose limitation enforced programmatically. This aligns with Protected B and PIA obligations — build it into the data access layer, not as a policy overlay.

### 5. Forensic-Grade Audit Trail
Every agent action must log: subject, actor, delegation chain, purpose, resource accessed, and policy decision made. Target OTEL-compatible centralized logging for compliance, SIEM, and audit. Go beyond usage monitoring — capture provenance.

### 6. Agent Identity & Scoped Authority
Each EVA app/agent needs a distinct identity with scoped permissions (not a shared service account). Authority should be dynamic, ephemeral, and auditable. Map this to APIM headers and per-app tagging.

### 7. Interoperability & Shared Orchestration
Avoid siloed solutions. Use the IIAID pipeline and marketplace to standardize agent-to-agent communication protocols. Centralize agent registries so new solution spaces can discover and compose with existing agents.

### 8. Security for Autonomy
Threat models must account for agent-specific risks: prompt injection, agent impersonation, privilege escalation, and cascading failures across agent chains. Bake these into ST&E assessments.

### 9. Outcome-Based FinOps
Extend APIM cost-attribution beyond consumption metrics. Track outcome-based KPIs (e.g., resolution rate, time-to-answer, citation accuracy) alongside cost. Variable cost models will matter as agent usage scales non-linearly.

### 10. Bilingual, Accessible, Culture-Ready
All agents must be EN/FR bilingual and WCAG 2.1 AA compliant by default. Design for a workforce that becomes orchestrators and exception-handlers, not processors. Change management is an enablement layer, not an afterthought.

### 11. Confidence Scoring & Disclosure (EVA Addition)

> **Note:** The Agentic State paper does not explicitly address confidence levels. This principle is an EVA-originated addition that fills a gap in the framework.

Agents must measure and disclose the confidence level of every answer they produce. This is not optional UX polish — it is a governance and trust mechanism that ties directly into escalation, audit, and responsible AI:

- **Per-response confidence signal.** Every agent output should carry a computed confidence score (e.g., 0–1 or low/medium/high) derived from factors like: retrieval relevance scores, source coverage, answer grounding quality, and model uncertainty signals.
- **User-facing disclaimer.** Confidence must be surfaced to the end user alongside the answer — not buried in logs. Users (and reviewers) need to know when the system is less certain so they can apply appropriate judgment. Framing example: *"Confidence: Medium — based on partial source coverage; human review recommended."*
- **Escalation trigger.** Confidence thresholds should feed directly into the escalation tiers (Principle 3). Below a defined threshold → auto-escalate to human review. This makes the human-in-the-loop decision data-driven rather than blanket or arbitrary.
- **Audit trail enrichment.** Confidence scores become part of the forensic log (Principle 5) — enabling after-the-fact analysis of when agents were wrong, how confident they were at the time, and whether the system correctly escalated.
- **Calibration over time.** Track predicted confidence vs. actual accuracy to calibrate the scoring model. If the agent says "high confidence" but is wrong 30% of the time, the scoring needs retraining. This feeds the outcome-based FinOps metrics (Principle 9) as well.
- **Bilingual parity.** Confidence scoring must perform equivalently in EN and FR. A weaker French retrieval corpus should not silently degrade answer quality — it should lower the confidence score and flag the gap.

This principle closes a loop the Agentic State framework leaves open: the paper defines when humans should be involved (governance) and what should be logged (audit), but not how the system itself signals uncertainty. Confidence scoring is the mechanism that connects autonomous operation to responsible disclosure.

---

## EVA Alignment Scorecard

| Agentic State Principle | Current EVA Status | Action Needed |
|---|---|---|
| Compliance-as-code | Guardrails exist, but policy is documented not executable | Encode TBS/ESDC rules as runtime policy engine |
| Forensic audit trail | Usage monitoring + logging in place | Upgrade to per-action provenance with OTEL-compatible format |
| RAG-first with citations | Core architecture — strong alignment | Maintain; extend citation granularity (pinpoint refs) |
| Human escalation tiers | Human-in-the-loop exists | Formalize auto/review/human tiers with confidence thresholds |
| Proactive service | EVA Chat is reactive | Prototype push-based workflows (e.g., case alerts, deadline reminders) |
| FinOps outcome-based | APIM cost attribution headers in place | Add outcome KPIs alongside consumption; variable cost modeling |
| Agent identity | Shared codebase, per-app tagging | Define per-agent identity with scoped, ephemeral permissions |
| Interoperability | IIAID pipeline underway | Standardize A2A protocol; build agent registry in marketplace |
| Security for autonomy | ST&E process exists | Add agent-specific threat models (injection, impersonation, cascading) |
| People & culture | Training exists | Develop orchestrator/exception-handler role definitions |
| **Confidence scoring** *(EVA addition)* | Not yet implemented | Build per-response confidence signal; surface to users; wire to escalation tiers |

---

## Next Steps

- [ ] Map each principle to specific EVA refactor backlog items in 53-EVA-Refactor.
- [ ] Draft a "compliance-as-code" spike: pick one TBS rule and encode it as executable policy.
- [ ] Propose escalation tier definitions for Jurisprudence and AssistMe use cases.
- [ ] Evaluate OTEL-compatible logging options within Azure (Canada) constraints.
- [ ] Socialize this scorecard with AI CoE stakeholders.
- [ ] Design confidence scoring approach: define signal inputs (retrieval relevance, source coverage, model uncertainty), output scale, and user-facing disclosure format.
- [ ] Wire confidence thresholds to escalation tiers — define the cutoffs for auto/review/human.

---

*This note is a working reference — update as the refactor progresses and as the Agentic State initiative publishes implementation guidance.*
