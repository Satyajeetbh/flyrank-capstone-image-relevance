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

## 2026-09-03 — Stage 7 OpenAI embedding provider

- Added the focused OpenAI embedding provider using `text-embedding-3-small` and the fixed 1536-dimension embedding contract.
- Added deterministic canonical text representations for image metadata and post title/content.
- Added validation for embedding shape, exact dimension, finite numeric values, and provider/API error classification.
- Added offline unit tests for canonical representations, valid output, invalid dimensions/values, low-level provider failures, and the fixed model constant.
- Did not add embedding persistence, pgvector queries, repositories, matching, ranking, guard changes, queues, workers, cost tracking, or evaluation.

## 2026-09-03 — Stage 8 embedding persistence/data access

- Added focused image and post embedding repositories over the existing pgvector schema.
- Added 1536-dimension finite-number validation and pgvector serialization/parsing inside the repository layer.
- Added PostgreSQL-backed integration verification for embedding save, retrieval, missing records, invalid vectors, and cleanup.
- Reused existing unique constraints and deliberately did not introduce an upsert policy.
- Did not add migrations, dependencies, semantic search, similarity calculation, ranking, matching, queues, workers, or provider changes.

## 2026-09-03 — Stage 9 semantic retrieval and ranking

- Added exact pgvector cosine-distance retrieval for stored post embeddings and completed images with stored metadata.
- Added a small application service that loads a post and its stored embedding before returning ranked image candidates.
- Added the `GET /posts/:id/images` Express router with Zod UUID validation and safe HTTP error responses.
- Added PostgreSQL-backed integration coverage for ranking, cosine similarity values, top-K behavior, metadata projection, and missing post embeddings.
- Did not add guard integration, `NO_CONFIDENT_MATCH` decisions, OpenAI calls, ANN indexing, migrations, queues, workers, evaluation, or ranking beyond cosine-similarity order.

## 2026-09-03 — Stage 10 deterministic mismatch guard integration

- Connected ranked semantic candidates to the existing deterministic mismatch guard in the application service.
- Selects the first ranked candidate whose guard decision is `ACCEPT`; rejected and reviewed candidates remain in `alternatives`.
- Returns `NO_CONFIDENT_MATCH` with a null recommendation when no candidate is accepted.
- Extended the existing `/posts/:id/images` response through the same route without persisting suggestions.
- Added PostgreSQL-backed integration coverage for accepted candidates, subject mismatch, low vision confidence, no confident match, and selecting a lower-ranked accepted candidate.
- Did not add OpenAI calls, suggestion persistence, review endpoints, queues, workers, evaluation, or threshold changes.

## 2026-09-03 — Stage 11 persist matching suggestions

- Added a typed `SuggestionRepository` for creating persisted evaluated candidates in the existing `suggestions` table.
- Explicitly mapped domain guard decisions (`ACCEPT`, `REJECT`, `REVIEW`) to database statuses (`accept`, `reject`, `review`).
- Updated the Stage 10 matching workflow to persist every evaluated candidate and return its `suggestionId`.
- Preserved first-accepted recommendation selection and `NO_CONFIDENT_MATCH` behavior.
- Added PostgreSQL-backed coverage for accepted, rejected, reviewed, and no-confident-match persistence.
- Did not add migrations, review workflows, idempotency keys, or suggestion uniqueness constraints.
