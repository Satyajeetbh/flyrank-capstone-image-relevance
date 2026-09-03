# FlyRank AI Image Understanding & Content Matching Engine

This repository contains the TypeScript foundation and Stage 2 PostgreSQL persistence layer for the FlyRank capstone project.

## Current scope

Stage 2 establishes PostgreSQL locally and the initial versioned schema. It does not implement API endpoints, OpenAI integration, Redis/BullMQ, repositories, services, matching logic, mismatch guard logic, or application business logic.

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

The Compose file uses the same variables with local defaults. `.env` is ignored by Git.

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
