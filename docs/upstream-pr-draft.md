# Upstream PR draft — RFC for Microsoft / PubSec-Info-Assistant

> Prepared 2026-04-21. **Do not file this as an issue on the upstream repo until the [GitHub Discussion](https://github.com/microsoft/PubSec-Info-Assistant/discussions) and the [isat-support@microsoft.com](mailto:isat-support@microsoft.com) outreach have surfaced a positive signal from the maintainer team.** See [BACKLOG.md §2 → "Upstream-PR description draft"](../BACKLOG.md) for context.
>
> This file is the reserve text for Phase B of the upstream-contribution sequence. Phase A (Discussion + direct email) has been sent. If Phase A is silent after ~14 days, reconsider whether to file this RFC cold or take a different path (Azure Marketplace, sibling accelerator, standalone distribution).

---

**Target**: [github.com/microsoft/PubSec-Info-Assistant/issues/new](https://github.com/microsoft/PubSec-Info-Assistant/issues/new) — Feature Request or blank template.

**Title**: RFC: agentic, governance-first evolution of the template (AIA)

**Body**:

### Summary

Formalising the proposal discussed in [Discussion #XXX — replace with link once filed] / the prior email thread with the IS&A team: adopt (in whole or in slices) **AIA — Agentic Information Assistant** as the next-generation path for this template.

**Reference implementation (public, MIT-licensed)**: https://github.com/eva-foundry/PubSec-Agentic-InfoAsst

### Motivation

The current IA template was built when RAG meant "single-shot retrieval + generation + citations." Three things have changed since:

1. **Agentic patterns are mainstream.** ReAct, tool registries, and multi-step planners with per-step provenance are table-stakes for serious use. One-shot RAG can't express multi-hop reasoning or tool orchestration.
2. **Governance expectations are different.** Public-sector deployments now routinely require HITL gates on decision-informing outputs, behavioural fingerprints (model + prompt + corpus + policy versions), audit-ready provenance, and explicit multi-source conflict resolution. These aren't bolt-ons; they belong in the architecture.
3. **The Agentic State paper** (Ilves et al., Tallinn Digital Summit 2025) — backed by 20+ digital-government leaders and the World Bank — sets out a 12-layer model that maps directly onto what a next-generation IA should look like. AIA implements that mapping.

### What AIA adds to the IA template

- ReAct-style agentic planner with a governed tool registry (classification ceiling / residency / language / HITL flag per tool).
- Responsible-AI gates (advisory vs decision-informing; mandatory HITL on decision-informing).
- Explainable provenance: retrieval path, reasoning trace, negative evidence, source freshness, behavioural fingerprint on every answer.
- Multi-language operation with translation as a first-class tool.
- FinOps cost attribution through APIM with per-workspace cost-centre rollups.
- Source-authority classifier + multi-source conflict resolver with arbitration hierarchy.
- Three-portal operator surface: workspace self-service + admin + ops (FinOps / AIOps / LiveOps / DevOps / compliance / red-team).

All covered by 13 Playwright-captured screenshots in the repo's README under "The running app."

### Proposed path — slices, not a monolith

Not one monster PR. If there is agreement on direction, proposed cadence:

1. **RFC freeze** — this issue, with architectural diagrams + the 12-layer mapping from [`Agentic-State-Vision.md`](https://github.com/eva-foundry/PubSec-Agentic-InfoAsst/blob/main/Agentic-State-Vision.md).
2. **Slice 1** — provenance / citation / explainability layer on top of the existing IA retrieval. Incremental, no planner yet.
3. **Slice 2** — governed tool registry + Responsible-AI gates.
4. **Slice 3** — ReAct planner wired to the registry.
5. **Slice 4** — multi-source conflict resolver + source-authority classifier.
6. **Slice 5** — FinOps cost-centre attribution through APIM.
7. **Slice 6** — operator portal surface (may be out of scope for the template and more appropriate as a sibling repo — open to guidance).

Each slice carries its own tests and does not depend on the next. Reviewers can accept or reject per slice.

### Open questions for maintainers

1. Is IA v2 on the roadmap? If yes, does AIA's direction align, or is there a different direction in mind?
2. Does the template want to stay one-shot-RAG and leave agentic patterns to sibling templates / accelerators? Valid answer; good to know up front.
3. AI-assisted commit attribution: the reference repo's history credits Claude as co-author on some commits. What is the current policy for contributions on this repo — is CLA sign-off sufficient, is explicit AI disclosure required in the PR description, or is it a blocker?

Happy to walk through the repo on a call or answer anything inline.
