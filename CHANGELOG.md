# AIA Changelog

All notable changes to AIA are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html) once a `v1.0.0` baseline ships.

## [Unreleased]

### Added
- Opensource scaffold: `LICENSE`, `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`, `SECURITY.md`, `SUPPORT.md`, `NOTICE.md`, this `CHANGELOG.md`.
- `data/sample-documents/README.md` explaining the bring-your-own-corpus policy for the demo pipeline.
- `BACKLOG.md` consolidating known open work for the upstream-PR path.

### Changed
- Renamed the project from its internal name to **AIA (Agentic Information Assistant)**, framed as a refactor of Microsoft's Information Assistant template that implements the concepts of *The Agentic State* (Ilves et al., 2025). All API routes, package names, Docker image names, Azure resource names, logger namespaces, and documentation now use the `AIA` / `aia` identifier.
- Scrubbed organization-specific branding: references to one specific public-sector organization, its AI Centre of Expertise, and its internal compliance frameworks have been replaced with neutral equivalents (`NIST 800-53` in place of the country-specific control catalog; `RAI Level` in place of the country-specific conformance framework; `sensitive` / `restricted` in place of country-specific classification levels).

### Removed
- Legacy `.archive/` tree containing v1 portal apps (superseded by the current `apps/portal-unified/` UI).
- Internal phase-closeout documentation under `docs/archive/`.
- `CLAUDE.md` (internal Claude Code instructions, not relevant to downstream consumers).
- `Road-to-ATO-n-Continuous-Authorization.md` (country-specific compliance process document).
- Country-specific sample corpus under `data/sample-documents/` (Benefits Act, the social benefits Act, tribunal decision excerpts). Replaced with a README directing users to bring their own corpus.
