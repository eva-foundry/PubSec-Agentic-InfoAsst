# Contributing to AIA

AIA (Agentic Information Assistant) is proposed as an evolution of Microsoft's [Information Assistant agent template](https://github.com/microsoft/PubSec-Info-Assistant), implementing the concepts of [The Agentic State](https://agenticstate.org/paper.html). This project welcomes contributions and suggestions.

Most contributions will require you to agree to a Contributor License Agreement (CLA) declaring that you have the right to, and actually do, grant us the rights to use your contribution. When AIA is accepted upstream into the Microsoft organization, contributions will flow through Microsoft's standard CLA at [https://cla.opensource.microsoft.com](https://cla.opensource.microsoft.com).

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/). For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.

## Table of contents

- [Code of Conduct](#code-of-conduct)
- [Issues and bugs](#issues-and-bugs)
- [Feature requests](#feature-requests)
- [Submission guidelines](#submission-guidelines)
- [Development setup](#development-setup)
- [Coding standards](#coding-standards)

## Code of Conduct

Help us keep this project open and inclusive. Please read and follow our [Code of Conduct](./CODE_OF_CONDUCT.md).

## Issues and bugs

If you find a bug in the source code or a mistake in the documentation, help us by [submitting an issue](#submitting-an-issue). Even better — [submit a pull request](#submitting-a-pull-request) with a fix.

## Feature requests

You can *request* a new feature by [submitting an issue](#submitting-an-issue). If you would like to *implement* a new feature, please submit an issue with a proposal first so we can align on scope and design before you invest significant work.

**Small features** can be crafted and directly [submitted as a pull request](#submitting-a-pull-request).

## Submission guidelines

### Submitting an issue

Before you submit an issue, search the archive — your question may already be answered. If your issue appears to be a bug and hasn't been reported, open a new issue. Help us maximize the effort we can spend fixing issues by not reporting duplicates.

Please provide:

- A short, descriptive title
- A minimal reproduction (code snippets, screenshots, or a short video)
- What you expected to happen vs. what actually happened
- Your environment: OS, browser, AIA version / commit SHA, Azure region
- For security issues: follow [SECURITY.md](./SECURITY.md) instead of opening a public issue

### Submitting a pull request

1. Fork the repo and create your branch from `main`.
2. Make your change, keeping commits focused and well-described.
3. Add or update tests; the CI gates (backend pytest, frontend type-check and tests, infra lint) must remain green.
4. Update the relevant docs (`README.md`, `docs/`) if your change affects user-facing behaviour.
5. Open a pull request describing the *why* as well as the *what*.

## Development setup

See the [Developer Setup](./README.md#developer-setup) section of the top-level README for environment requirements, local-run commands, and test commands across backend services, the unified frontend, and the Azure infrastructure-as-code.

## Coding standards

- **Python** — black + ruff + mypy clean. Type hints on every public function. Tests use `pytest` + `pytest-asyncio`.
- **TypeScript** — strict mode; `tsc -b` clean. Tests use `vitest`. UI tests use `@testing-library/react`.
- **Bicep** — linted via `az bicep build`. Parameters in `*.bicepparam` files, not hardcoded.
- **Commits** — imperative mood, concise subject line, body explaining *why* when the diff alone doesn't.
- **Agent prompts and policy rules** — changes to `services/api-gateway/app/guardrails/policy_rules.json` or prompt templates require an accompanying test in `services/api-gateway/tests/` demonstrating the new behaviour and a corresponding entry in [CHANGELOG.md](./CHANGELOG.md).

## Scope of contributions

This repository is proposed as a refactor of the Information Assistant template, not a separate product. Contributions should align with that positioning — incremental improvements to the agentic pattern, guardrails, observability, and multi-language support are in scope; forking the project in a different direction is not.
