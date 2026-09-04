# FlyRank AI Image Understanding & Content Matching Engine

This repository contains the TypeScript foundation, Stage 2 PostgreSQL persistence layer, Stage 3 PostgreSQL application access layer, Stage 4 core repositories, Stage 5 domain/application contracts, Stage 6 vision provider, Stage 7 embedding provider, Stage 8 embedding persistence repositories, and Stage 13 retrieval evaluation for the FlyRank capstone project.

## Current scope

Stage 2 establishes PostgreSQL locally and the initial versioned schema. Stage 3 adds a minimal TypeScript connection pool and database reachability check. Stage 4 adds basic repositories for `images` and `posts`. Stage 5 adds validated image-metadata types, deterministic mismatch-guard decisions, and small matching contracts. Stage 6 adds the OpenAI vision provider and Zod validation boundary for image understanding. Stage 7 adds the OpenAI text-embedding provider and deterministic text representations. Stage 8 adds embedding persistence repositories for images and posts. Stage 13 adds reproducible baseline-versus-guarded retrieval evaluation. It does not implement API endpoints, Redis/BullMQ, vector search beyond the existing exact retrieval, matching changes, or application business logic.

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

The deterministic mismatch guard originally used provisional thresholds of `0.75` for semantic similarity and `0.70` for vision confidence. After calibration against the current real-embedding evaluation corpus, the production semantic similarity threshold is now `0.66`; the vision-confidence threshold remains `0.70`. Both values are centralized in `src/domain/guard-policy.ts`.

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

## Stage 7 OpenAI embedding provider

The embedding provider uses the fixed `text-embedding-3-small` model and validates exactly 1536 finite numeric values. It accepts image metadata or a post title/content input and returns `number[]`; it does not persist or search vectors.

Canonical image representation:

```text
Subject: <subject>
Category: <category>
Attributes: <comma-separated attributes>
Caption: <caption>
```

Canonical post representation:

```text
Title: <title>
Content: <content>
```

Provider/API failures are classified as `provider_api_failure`; malformed or incorrectly sized embedding responses are classified separately as invalid provider output. No real API call is required by the unit tests.

## Stage 8 embedding persistence

`ImageEmbeddingRepository` and `PostEmbeddingRepository` save and retrieve `number[]` vectors through the existing `image_embeddings` and `post_embeddings` tables. The repositories validate exactly 1536 finite numeric values, serialize writes as parameterized pgvector literals, and parse `embedding::text` reads back into `number[]`.

The existing unique constraints on `(image_id, embedding_model)` and `(post_id, embedding_model)` reject duplicate writes. No upsert policy, semantic retrieval, similarity calculation, or ranking is implemented.

Run the PostgreSQL-backed embedding verification with the required database variables set:

```bash
npm run verify:embeddings
```

## Stage 13 retrieval evaluation

The evaluation dataset is stored in `data/evaluation/labeled-posts.json` and contains 10 labeled post/image pairs. The entity fixture seeds only posts and image metadata; embeddings must be generated with the existing OpenAI provider:

```bash
docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U flyrank -d flyrank < data/evaluation/seed-evaluation.sql
OPENAI_API_KEY=<key> POSTGRES_HOST=localhost POSTGRES_PORT=5432 POSTGRES_DB=flyrank POSTGRES_USER=flyrank POSTGRES_PASSWORD=flyrank_local_password npm run generate:evaluation
```

Corpus generation calls OpenAI and incurs embedding usage. After generated vectors are persisted, evaluation itself is offline:

```bash
POSTGRES_HOST=localhost POSTGRES_PORT=5432 POSTGRES_DB=flyrank POSTGRES_USER=flyrank POSTGRES_PASSWORD=flyrank_local_password npm run evaluate:retrieval
```

The evaluator reports baseline top-1 accuracy from the highest-similarity candidate and guarded top-1 accuracy from the existing matching workflow. It also reports no-confident-match count, accepted incorrect matches, and expected images retrieved but rejected by the guard. The experiment-only calibration mode reports threshold sweeps without changing production configuration. Calibration evidence showed `0.660` and `0.661` at 10/10 guarded correctness with zero incorrect accepted matches, while `0.662` dropped to 9/10. The rounded `0.66` threshold was selected as the highest practical rounded threshold supported by the current 10-post corpus; it is not universally optimal. Evaluation does not call OpenAI or persist evaluation tables.

## Stage 14 AI usage and cost tracking

The AI usage layer maps provider usage into the existing `ai_usage` table for calls made by the evaluation corpus generator. Vision usage maps Responses API `input_tokens` and `output_tokens`; embedding usage maps `prompt_tokens` to input units and records zero output units because the installed embeddings response exposes no output-token field. Failed provider calls are not recorded as successful usage.

Pricing is intentionally unconfigured until verified provider pricing is supplied. Cost calculation returns no estimate when pricing is absent; the database default is used only when no estimate is available. No OpenAI API call is required for builds or tests.

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
