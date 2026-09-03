# FlyRank AI Image Understanding & Content Matching Engine

This repository contains the initial TypeScript foundation for the FlyRank capstone project.

## Current scope

The project is intentionally limited to a buildable repository structure. Application behavior is not implemented yet. In particular, this foundation does not include database schema, API endpoints, provider integrations, queues, embeddings, matching logic, mismatch guards, repositories, services, or business logic.

## Requirements

- Node.js 20 or newer
- npm

## Setup

```bash
npm install
```

## Verification

Build the TypeScript source into `dist/`:

```bash
npm run build
```

Run the compiler without emitting files:

```bash
npm run typecheck
```

## Repository layout

- `src/api` — future transport-layer code
- `src/application` — future application orchestration
- `src/domain` — future domain model
- `src/infrastructure` — future external-system adapters
- `src/jobs` — future background job entry points
- `src/providers` — future provider boundaries
- `src/repositories` — future persistence boundaries
- `src/schemas` — future input/output schemas
- `tests/unit` — unit tests
- `tests/integration` — integration tests
- `tests/evaluation` — evaluation tests and fixtures
- `scripts` — project maintenance scripts
- `data/seed` — seed data
- `data/evaluation` — evaluation data
- `migrations` — future database migrations
- `docs` — project documentation

See `BUILDLOG.md` for foundation changes and `EVIDENCE.md` for verification evidence. Configuration placeholders are documented in `.env.example`.
