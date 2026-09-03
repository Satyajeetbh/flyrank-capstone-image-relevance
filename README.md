# FlyRank AI Image Understanding & Content Matching Engine

This repository contains the TypeScript foundation, Stage 2 PostgreSQL persistence layer, Stage 3 PostgreSQL application access layer, Stage 4 core repositories, and Stage 5 domain/application contracts for the FlyRank capstone project.

## Current scope

Stage 2 establishes PostgreSQL locally and the initial versioned schema. Stage 3 adds a minimal TypeScript connection pool and database reachability check. Stage 4 adds basic repositories for `images` and `posts`. Stage 5 adds validated image-metadata types, deterministic mismatch-guard decisions, and small matching contracts. Stage 6 adds the OpenAI vision provider and Zod validation boundary for image understanding. It does not implement API endpoints, Redis/BullMQ, future-stage repositories, services, vector search, matching orchestration, embeddings, or application business logic.

The embedding decision for the persistence schema is authoritative: OpenAI `text-embedding-3-small`, stored as `vector(1536)` for both image and post embeddings. This records the storage contract only; provider integration is a future stage.

## Requirements

- Node.js 20 or newer
- npm
- Docker Desktop with Compose

## Configuration

Copy `.env.example` to `.env` and adjust local values if needed:

- `POSTGRES_HOST` — database host used by local clients; defaults to `localhost`
- `POSTGRES_PORT` — exposed host port; defaults to `5432`
- `POSTGRES_DB` — database name; defaults to `flyrank`
- `POSTGRES_USER` — database user; defaults to `flyrank`
- `POSTGRES_PASSWORD` — local database password; defaults to `flyrank_local_password`
- `OPENAI_API_KEY` — required only when calling the OpenAI vision provider

The Compose file uses the same database variables with local defaults. `.env` is ignored by Git. Never commit API keys.

## Start PostgreSQL

```bash
docker compose up -d postgres
```

The service uses the `pgvector/pgvector:pg16` image and a persistent named volume named `postgres_data`.

## Apply migrations

Migrations are plain SQL and are intentionally kept dependency-free. Apply them in filename order from the repository root after PostgreSQL is healthy:

The commands below use the documented local defaults. If you override the database name or user, replace `flyrank` in the commands accordingly:

```bash
docker compose exec -T postgres psql -U flyrank -d flyrank < migrations/001_enable_extensions.sql
docker compose exec -T postgres psql -U flyrank -d flyrank < migrations/002_create_core_tables.sql
docker compose exec -T postgres psql -U flyrank -d flyrank < migrations/003_create_indexes.sql
```

The migrations are safe to re-run on a clean or already initialized development database through `IF NOT EXISTS` guards.

## Verify PostgreSQL and pgvector

```bash
docker compose ps postgres
docker compose exec -T postgres psql -U flyrank -d flyrank -c "SELECT extname FROM pg_extension WHERE extname = 'vector';"
docker compose exec -T postgres psql -U flyrank -d flyrank -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;"
docker compose exec -T postgres psql -U flyrank -d flyrank -c "SELECT table_name, column_name, udt_name FROM information_schema.columns WHERE table_name IN ('image_embeddings', 'post_embeddings') AND column_name = 'embedding' ORDER BY table_name;"
```

## Application database check

The infrastructure database module requires `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, and `POSTGRES_PASSWORD`. Set these variables in the shell before running the check; `.env` is not loaded automatically by Node.

```bash
npm run verify:db
```

The command builds the TypeScript source, executes `SELECT 1` through the shared pool, and closes the pool. It exits non-zero if configuration is missing or PostgreSQL is unreachable.

## Stage 5 guard policy

The deterministic mismatch guard uses provisional thresholds of `0.75` for semantic similarity and `0.70` for vision confidence. These values are centralized in `src/domain/guard-policy.ts` and must be tuned against the labeled evaluation set; they are not presented as empirically optimal.

The guard returns `REVIEW` with `MISSING_METADATA` when required subject, category, or vision-confidence data is absent. A candidate without a usable similarity score returns `REJECT` with `NO_USABLE_CANDIDATE`. Accepted results have no failure reason code (`null`).

## Repository verification

After PostgreSQL is running and migrations have been applied, set the required database variables and run:

```bash
npm run verify:repositories
```

The verification creates unique image and post rows, retrieves and lists them, updates the image processing status, and removes the inserted rows afterward.

## Stage 5 unit tests

```bash
npm run test:unit
```

The unit tests execute the compiled deterministic guard and OpenAI provider parsing boundary with Node's built-in test runner. They do not call the real OpenAI API.

## Stage 6 OpenAI vision provider

The provider accepts an image URL and requests structured image-understanding output from the configured OpenAI vision-capable model. Zod validates and normalizes the response into provider-neutral `ImageMetadata` before it reaches the domain layer.

Provider/API failures and invalid model output are classified separately. Valid low-confidence metadata remains valid output; the deterministic mismatch guard remains responsible for deciding whether it should be accepted, rejected, or reviewed. Embeddings are intentionally not part of Stage 6.

The selected model is `gpt-4.1-mini`, defined in `src/providers/openai-vision.ts` so it can be changed in a later stage without introducing model-selection infrastructure.

## TypeScript verification

```bash
npm run typecheck
npm run build
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
- `migrations` — versioned SQL migrations
- `docs` — project documentation

See `BUILDLOG.md` for implementation history and `EVIDENCE.md` for recorded verification evidence.
