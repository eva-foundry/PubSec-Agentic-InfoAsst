# Third-party open-source software notice

AIA (Agentic Information Assistant) depends on a number of third-party open-source packages. This file lists the major ones; for the full set, consult the lockfiles:

- Python: [`services/api-gateway/requirements.txt`](./services/api-gateway/requirements.txt), [`services/doc-pipeline/requirements.txt`](./services/doc-pipeline/requirements.txt), [`services/enrichment/requirements.txt`](./services/enrichment/requirements.txt)
- Node: [`package.json`](./package.json), [`package-lock.json`](./package-lock.json) at repository root and inside [`apps/portal-unified/`](./apps/portal-unified/)
- Infrastructure: [`infra/`](./infra/) (Bicep)

## Major Python dependencies

- **FastAPI** — web framework, MIT
- **uvicorn** — ASGI server, BSD-3-Clause
- **pydantic** — data validation, MIT
- **azure-identity** — Microsoft Azure SDK, MIT
- **azure-search-documents** — Microsoft Azure SDK, MIT
- **azure-ai-formrecognizer** — Microsoft Azure SDK, MIT
- **openai** — OpenAI Python SDK, Apache-2.0
- **opentelemetry-api / opentelemetry-sdk** — OpenTelemetry, Apache-2.0
- **pytest** / **pytest-asyncio** — MIT

## Major Node dependencies

- **React / react-dom** — MIT
- **Vite** — MIT
- **TypeScript** — Apache-2.0
- **@tanstack/react-query** — MIT
- **@playwright/test** — Apache-2.0
- **vitest** — MIT
- **msw** (Mock Service Worker) — MIT

## Attribution to the upstream template

AIA is derived from and proposed as a refactor of [microsoft/PubSec-Info-Assistant](https://github.com/microsoft/PubSec-Info-Assistant) (MIT Licensed, Copyright © Microsoft Corporation). Implementation patterns, security posture, and deployment scripts took design inspiration from that template. No code was ported verbatim; the AIA implementation is a from-scratch rewrite around an agentic planner, a tool registry, Responsible-AI guardrails, and multi-language operation.

## Attribution to The Agentic State

The architectural framing is directly influenced by *[The Agentic State: Rethinking Government for the Era of Agentic AI](https://agenticstate.org/paper.html)* by Luukas Ilves, Manuel Kilian, Simone Maria Parazzoli, Tiago C. Peixoto, and Ott Velsberg (Tallinn Digital Summit, 2025). The 12-layer model informs AIA's internal architecture; see [Agentic-State-Vision.md](./Agentic-State-Vision.md) and [AIA-Design-Principles-Beyond-Agentic-State.md](./AIA-Design-Principles-Beyond-Agentic-State.md) for the mapping and the gaps AIA addresses beyond the paper.
