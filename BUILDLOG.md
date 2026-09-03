# Build Log

## 2026-09-03 — Stage 2 PostgreSQL persistence

- AI-assisted implementation of the PostgreSQL persistence foundation.
- Added a PostgreSQL 16 pgvector Compose service with configurable local database credentials, a persistent named volume, port mapping, and healthcheck.
- Recorded the authoritative embedding decision: OpenAI `text-embedding-3-small` with 1536 dimensions.
- Added plain SQL migrations for extensions, core tables, constraints, and indexes.
- Added UUID primary keys, foreign keys, timestamps, status checks, confidence/similarity checks, JSONB image attributes, and `vector(1536)` embedding columns.
- Kept migration execution dependency-free; no ORM or migration runner was added because ordered `psql` commands are sufficient at this stage.
- Did not add OpenAI integration, repositories, services, controllers, routes, Redis, BullMQ, matching logic, mismatch guard logic, or business logic.

## 2026-09-03 — Stage 3 PostgreSQL application integration

- AI-assisted implementation of the minimal PostgreSQL application access boundary.
- Added the standard `pg` client and `@types/pg` declarations.
- Added a module-level PostgreSQL pool under `src/infrastructure/database.ts` using required environment variables and credential-safe error handling.
- Added a `SELECT 1` connectivity check and a standalone resource-safe verification script at `scripts/verify-database.mjs`.
- Added the `verify:db` npm script; no ORM or migration runner was introduced.
- Did not add repositories, services, routes, provider calls, queues, or application business logic.

## 2026-09-03 — Stage 4 core repository/data-access layer

- AI-assisted implementation of the bounded core data-access layer.
- Added typed `ImageRepository` operations for create, find by ID, list, and processing-status update.
- Added typed `PostRepository` operations for create, find by ID, and list.
- Reused the existing shared PostgreSQL pool and used explicit columns with parameterized SQL throughout.
- Added a standalone repository integration verification with unique test data and cleanup.
- Did not modify migrations or add repositories for the other seven schema entities.
- Did not add future-stage AI, matching, guard, queue, worker, HTTP, or application business logic.

## 2026-09-03 — Stage 5 domain/application foundation

- Added the typed provider-neutral `ImageMetadata` domain contract for validated image understanding output.
- Added a deterministic mismatch guard with `ACCEPT`, `REJECT`, and `REVIEW` decisions plus the brief's machine-readable reason codes.
- Centralized provisional semantic-similarity (`0.75`) and vision-confidence (`0.70`) thresholds in `src/domain/guard-policy.ts`; these require tuning against the labeled evaluation set.
- Added the small `MatchingResult` and candidate-context contracts needed by a later orchestration stage without implementing orchestration.
- Added focused Node built-in unit tests for guard outcomes, missing metadata, and threshold boundaries.
- Did not add runtime provider validation, OpenAI, database access, repositories, embeddings, vector search, queues, HTTP, or business workflows.

## 2026-09-03 — Stage 6 OpenAI vision provider

- Added the official OpenAI Node.js SDK and Zod.
- Added a focused OpenAI vision provider accepting an image URL and requesting strict structured output using `gpt-4.1-mini`.
- Added provider-boundary Zod validation and normalization into the existing provider-neutral `ImageMetadata` domain type.
- Classified provider/API failures separately from invalid model output; valid low-confidence output remains valid metadata.
- Added offline unit tests for valid, invalid, and low-confidence structured responses without making a real API call.
- Did not add embeddings, persistence changes, repository changes, vector search, queues, routes, matching orchestration, or AI usage tracking.
