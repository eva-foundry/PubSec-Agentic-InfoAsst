# EVA Design Principles — Beyond the Agentic State

**Date:** 2026-04-14  
**Context:** Gaps identified in the Agentic State framework (Ilves et al., 2025) that EVA should address as additional design principles. These complement the 12-layer model — they don't contradict it, they fill holes the paper leaves open.  
**Companion doc:** `Agentic-State-Vision.md` (same folder)

---

## Why This Document Exists

The Agentic State paper provides an excellent macro-framework for how government should restructure around agentic AI. But it was written as a policy/governance vision, not as a solution architecture guide. When you actually build and operate RAG-based agents in a government setting — bilingual, Protected B, serving real citizens — you hit practical design problems the framework doesn't cover.

This document captures those gaps as concrete EVA design principles, each with rationale and implementation guidance.

---

## Principle 1: Confidence Scoring & Disclosure

> **Gap:** The paper defines when humans should be involved (governance) and what should be logged (audit), but not how the system itself signals uncertainty.

Agents must measure and disclose the confidence level of every answer they produce. This is not optional UX polish — it is a governance and trust mechanism.

**Design requirements:**

- **Per-response confidence signal.** Every agent output carries a computed confidence score (e.g., 0–1 or low/medium/high) derived from: retrieval relevance scores, source coverage, answer grounding quality, and model uncertainty signals.
- **User-facing disclaimer.** Confidence is surfaced to the end user alongside the answer — not buried in logs. Users and reviewers need to know when the system is less certain. Example: *"Confidence: Medium — based on partial source coverage; human review recommended."*
- **Escalation trigger.** Confidence thresholds feed directly into escalation tiers. Below a defined threshold → auto-escalate to human review. This makes the human-in-the-loop decision data-driven rather than blanket or arbitrary.
- **Audit trail enrichment.** Confidence scores become part of the forensic log — enabling after-the-fact analysis of when agents were wrong, how confident they were, and whether the system correctly escalated.
- **Calibration over time.** Track predicted confidence vs. actual accuracy. If the agent says "high confidence" but is wrong 30% of the time, the scoring model needs retraining. This feeds outcome-based FinOps metrics as well.
- **Bilingual parity.** Confidence scoring must perform equivalently in EN and FR. A weaker French retrieval corpus should not silently degrade answer quality — it should lower the confidence score and flag the gap.

**Why it matters for EVA:** Confidence scoring is the connective tissue between autonomous operation and responsible disclosure. Without it, escalation tiers are arbitrary, audit logs are incomplete, and users can't calibrate their trust.

---

## Principle 2: Explainability & Reasoning Transparency

> **Gap:** The paper emphasizes accountability and audit, but treats the agent as a black box. It doesn't address how users or auditors inspect the reasoning path.

Confidence tells the user *how sure* the agent is. Explainability tells them *why*. Both are required.

**Design requirements:**

- **Retrieval path visibility.** Surface which sources were retrieved, how they were ranked, and why they were selected. Users should be able to see "these 5 documents were considered; these 3 were used to generate the answer."
- **Reasoning chain disclosure.** For complex answers (especially Jurisprudence), show the synthesis logic — how the agent connected sources to arrive at a conclusion. This doesn't mean dumping chain-of-thought tokens; it means a structured, human-readable reasoning summary.
- **Negative evidence.** When relevant sources were *not* found or *excluded*, disclose that. "No tribunal decisions found for this specific scenario" is more useful than silence — and more honest.
- **Auditor-level detail on demand.** The user-facing explanation can be concise, but an auditor or reviewer should be able to drill into full retrieval scores, chunk-level relevance, and model parameters used. Two layers: user-facing summary + auditor-facing detail.
- **Bilingual reasoning.** If the query is in French but the strongest sources are English (or vice versa), the agent should disclose this cross-language retrieval and any translation steps involved.

**Why it matters for EVA:** In a legal/policy context (Jurisprudence, BDM Knowledge Management), users need to trust *and verify* — not just trust. A lawyer reviewing a tribunal summary needs to know why case X was surfaced and case Y wasn't. Accountability without explainability is performative.

---

## Principle 3: Temporal Validity & Source Freshness

> **Gap:** The paper covers data management broadly but doesn't address the shelf-life problem — RAG answers are only as good as the currency of the sources behind them.

Government sources go stale. Policies get amended, tribunal decisions get overturned, guidelines get updated, legislation changes. Agents must account for this.

**Design requirements:**

- **Source timestamp metadata.** Every document in the retrieval corpus carries a last-verified or last-updated date. This is a mandatory indexing field, not optional metadata.
- **Freshness-aware retrieval.** The retrieval layer should factor source age into ranking — recent sources weighted higher for time-sensitive domains, with configurable decay curves per corpus.
- **Staleness disclosure.** When an answer relies on sources older than a defined threshold, the agent discloses this. Example: *"This answer is based on guidance last updated 2024-03-15. Verify current applicability."*
- **Corpus health monitoring.** Automated alerts when a corpus hasn't been refreshed past its expected cadence — e.g., if the tribunal decisions index hasn't been updated in 30 days, flag it before users get stale answers.
- **Supersession detection.** Where feasible, detect when a source has been superseded (e.g., a policy document replaced by a newer version) and either exclude the old version or flag the conflict.

**Why it matters for EVA:** The Jurisprudence project retrieves tribunal and court decisions — legal material where currency is critical. An overturned decision cited with high confidence is worse than no answer at all. Freshness must be a first-class retrieval dimension.

---

## Principle 4: Graceful Degradation

> **Gap:** The paper covers crisis response at a macro level but doesn't address agent-level resilience — what happens when components fail.

Systems break. Retrieval indices go down, model endpoints get throttled, source corpora become temporarily unavailable. The question is whether the agent fails silently, hallucinates to fill the gap, or degrades gracefully.

**Design requirements:**

- **Partial answer with disclosure.** If only 3 of 5 source collections are reachable, answer from what's available and disclose the gap. Example: *"This answer is based on federal sources only; provincial tribunal index is currently unavailable."*
- **Fallback modes.** Define a degradation hierarchy: full RAG → partial RAG with disclosure → cached/static response → "I cannot answer this right now, here's who to contact." Each tier is explicit, not improvised.
- **No silent hallucination.** If the retrieval layer returns nothing relevant, the agent must say so — not generate a plausible-sounding answer from parametric knowledge alone. This is a hard rule for government use cases.
- **Health checks and circuit breakers.** Each dependency (retrieval index, model endpoint, source API) has a health check. When a dependency fails, the circuit breaker activates the next degradation tier automatically.
- **User communication.** Degraded mode is always communicated to the user. Never present a partial answer as if it were a full one.

**Why it matters for EVA:** In a Protected B Azure environment, network partitions, throttling, and maintenance windows are real. If the BDM SharePoint connector goes down, the Knowledge Management agent needs a plan — not a hallucination.

---

## Principle 5: Multi-Agent Conflict Resolution

> **Gap:** The paper envisions interoperability and agent orchestration across agencies, but doesn't address what happens when agents contradict each other.

As EVA grows into a marketplace of solution spaces (IIAID pipeline), multiple agents will operate over different corpora, policy lenses, and jurisdictions. They will sometimes give conflicting answers to the same question.

**Design requirements:**

- **Conflict detection.** The orchestration layer must detect when two or more agents return materially different answers to the same query. This requires semantic comparison, not just string matching.
- **Conflict surfacing.** Don't silently pick one answer. Present the conflict to the user with attribution: "Agent A (federal policy corpus) says X. Agent B (provincial tribunal corpus) says Y. The difference may be due to jurisdictional scope."
- **Arbitration rules.** Define a hierarchy for resolution where possible: legislation > regulation > policy > guidance. Where hierarchy doesn't resolve the conflict, escalate to human.
- **Provenance-based resolution.** When sources conflict, surface the provenance of each (date, authority, jurisdiction) so the user or reviewer can make an informed call.
- **Conflict logging.** Every detected conflict is logged for analysis — patterns of conflict reveal corpus gaps, policy inconsistencies, or stale sources.

**Why it matters for EVA:** The IIAID marketplace will have multiple solution spaces answering overlapping questions. A Jurisprudence agent and a BDM Knowledge Management agent may interpret the same policy differently based on their corpora. Without conflict resolution, users get inconsistent answers depending on which agent they happen to ask.

---

## Principle 6: Feedback Loops & Continuous Improvement

> **Gap:** The paper mentions evidence-based policy adaptation but doesn't address how agents themselves learn from user corrections and operational signals.

Without feedback loops, agents repeat the same mistakes. Human oversight becomes Sisyphean — reviewers correct the same errors that keep recurring because nothing flows back to improve the system.

**Design requirements:**

- **Correction capture.** When a human reviewer overrides, corrects, or rejects an agent answer, capture the correction with structured metadata: what was wrong, what the correct answer is, and why.
- **Retrieval quality feedback.** User signals (accepted/rejected, edited, escalated) should flow back to tune retrieval ranking — boosting sources that lead to accepted answers, demoting sources that lead to corrections.
- **Confidence calibration loop.** Corrections feed the confidence scoring model (Principle 1). If "high confidence" answers are frequently corrected in a specific domain, the confidence model is miscalibrated there.
- **Source quality scoring.** Over time, build a quality score per source/corpus based on how often its content leads to accepted vs. corrected answers. Flag low-quality sources for review.
- **Guardrail refinement.** Patterns in corrections should surface gaps in compliance-as-code rules. If reviewers keep catching the same policy violation the guardrails missed, that's a new rule to encode.
- **Privacy-safe aggregation.** Feedback is aggregated and anonymized before it influences model behavior. Individual user corrections are not exposed — only patterns.

**Why it matters for EVA:** The Jurisprudence project will have subject-matter experts reviewing agent outputs. Every correction they make is a training signal being thrown away if there's no feedback loop. Over time, the system should get better because humans are reviewing it — not despite that fact.

---

## Principle 7: Version Control & Rollback for Agent Behavior

> **Gap:** The paper doesn't address what happens when agent behavior changes — model updates, new policy rules, corpus changes — or how to trace and reverse those changes.

Agent behavior is a function of model + prompts + retrieval corpus + policy rules. Any of those can change, and when they do, answers change. In a government context, "why did the agent answer differently last week?" needs a traceable answer.

**Design requirements:**

- **Behavioral versioning.** Tag every agent response with a version fingerprint: model version, prompt version, corpus snapshot date, and active policy rules. This enables point-in-time reconstruction.
- **Change tracking.** When any component changes (model upgrade, prompt edit, corpus refresh, new policy rule), log the change with a timestamp and rationale.
- **A/B testing capability.** Before rolling out a change broadly, run it in parallel against the current version. Compare answer quality, confidence calibration, and user acceptance rates.
- **Rollback mechanism.** If a change degrades quality, roll back to the previous version quickly. This requires that previous model configs, prompts, and corpus snapshots are retained — not overwritten.
- **Regression detection.** Automated tests against a curated set of known-good question/answer pairs. If a change causes regressions on known cases, block the deployment.
- **Audit-ready change log.** For TBS and ESDC audit requirements, maintain a complete history of what the agent "was" at any point in time and why it changed.

**Why it matters for EVA:** The shared core codebase means a change in EVA's trunk affects every solution space. Without versioning and rollback, a well-intentioned model upgrade could silently degrade Jurisprudence citation accuracy or AssistMe response quality — and nobody would know until users complain.

---

## Principle 8: Contextual Adaptation Beyond Language

> **Gap:** The paper covers bilingualism and the people/culture layer, but doesn't address how agents adapt to different literacy levels, digital comfort, accessibility needs, and cultural contexts.

Government serves everyone — not just digitally fluent professionals. An agent that answers a legal question the same way for a lawyer and a first-time EI applicant is failing at service design.

**Design requirements:**

- **Adaptive complexity.** Agents should calibrate response complexity to the user's context. Plain language by default, with depth available on request. Detection signals: user's role, application context, explicit preference setting, or interaction patterns.
- **Accessibility beyond WCAG compliance.** WCAG 2.1 AA is the floor, not the ceiling. Consider cognitive accessibility: clear structure, short sentences, avoidance of jargon, progressive disclosure of detail.
- **Cultural sensitivity.** For programs serving diverse populations (EI, CPP, OAS), be aware of cultural context in how information is presented — particularly around sensitive topics like benefits eligibility, employment status, or family circumstances.
- **Channel-appropriate responses.** The same answer may need different treatment depending on channel: web chat, embedded assistant, API consumer, or future voice interface. Design agent responses as structured data that can be rendered differently per channel.
- **Indigenous language awareness.** While full Indigenous language support may be a longer-term goal, the system should at minimum not break on Indigenous names, place names, or terminology — and should route to appropriate human support when language needs exceed agent capability.

**Why it matters for EVA:** ESDC serves some of Canada's most vulnerable populations. Smart assistance means meeting people where they are — not expecting them to meet the system's assumptions about literacy, language, and digital fluency.

---

## Principle 9: Sandbox & Simulation Testing

> **Gap:** The paper doesn't address how to validate agentic systems before deploying them in live government contexts where wrong answers have real consequences.

You can't test an agent the way you test a CRUD application. Agent behavior is probabilistic, context-dependent, and emergent. Traditional QA isn't sufficient.

**Design requirements:**

- **Sandbox environment.** A production-like environment where agents can be tested against realistic queries without affecting real users or real data. Must mirror production retrieval indices, policy rules, and model configs.
- **Red-teaming protocol.** Structured adversarial testing: prompt injection attempts, edge-case queries, misleading inputs, bilingual confusion attacks, and attempts to extract information beyond the agent's authorized scope.
- **Scenario-based testing.** Curated test scenarios for each domain (Jurisprudence, AssistMe, BDM) with known-good answers validated by subject-matter experts. Run these as regression suites before any deployment.
- **Load and degradation testing.** Simulate component failures (Principle 4) and high-load conditions to verify graceful degradation works as designed.
- **Bias and fairness audits.** Test for differential treatment across EN/FR, across demographic scenarios, and across different types of queries. A benefits eligibility question should not get a materially different answer quality based on how it's phrased.
- **Pre-deployment gate.** No agent or agent update goes to production without passing the sandbox suite. This is the ST&E equivalent for agentic systems.

**Why it matters for EVA:** A wrong answer from the Jurisprudence agent could mislead a tribunal representative. A wrong answer from AssistMe could affect someone's benefits. The cost of errors is not a bad user experience — it's harm to real people. Testing must match the stakes.

---

## Summary Scorecard

| Principle | Agentic State Coverage | EVA Priority | First Target Use Case |
|---|---|---|---|
| Confidence scoring & disclosure | Not covered | High | All — cross-cutting |
| Explainability & reasoning transparency | Implied by audit, not specified | High | Jurisprudence |
| Temporal validity & source freshness | Partial (data management layer) | High | Jurisprudence, BDM KM |
| Graceful degradation | Not covered at agent level | Medium | All — infrastructure concern |
| Multi-agent conflict resolution | Not covered | Medium | IIAID marketplace |
| Feedback loops & continuous improvement | Partial (evidence-based policy) | High | Jurisprudence (SME reviewers) |
| Version control & rollback | Not covered | High | EVA shared core |
| Contextual adaptation beyond language | Partial (people/culture layer) | Medium | AssistMe, citizen-facing apps |
| Sandbox & simulation testing | Not covered | High | All — pre-deployment gate |

---

## Next Steps

- [ ] Prioritize these principles against the 53-EVA-Refactor backlog — some are quick wins (freshness metadata), others are architectural (conflict resolution).
- [ ] Design the confidence scoring approach first — it's the highest-leverage gap and touches everything else.
- [ ] Build a minimal sandbox environment for Jurisprudence as proof-of-concept for Principle 9.
- [ ] Define the feedback capture schema (Principle 6) so SME corrections start being logged even before the full loop is built.
- [ ] Propose versioning fingerprint format (Principle 7) for EVA shared core — get buy-in before the refactor locks in a new architecture.
- [ ] Socialize this document alongside the Agentic State Vision note with AI CoE stakeholders.

---

*These principles are EVA's contribution back to the Agentic State conversation — grounded in what you actually hit when you build and operate RAG agents in a government setting.*
