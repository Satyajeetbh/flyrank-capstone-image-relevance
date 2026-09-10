# Build Log

## 2026-09-03 --- Stage 2 PostgreSQL persistence

-   AI-assisted implementation of the PostgreSQL persistence foundation.
-   Added a PostgreSQL 16 pgvector Compose service with configurable
    local database credentials, a persistent named volume, port mapping,
    and healthcheck.
-   Recorded the authoritative embedding decision: OpenAI
    `text-embedding-3-small` with 1536 dimensions.
-   Added plain SQL migrations for extensions, core tables, constraints,
    and indexes.
-   Added UUID primary keys, foreign keys, timestamps, status checks,
    confidence/similarity checks, JSONB image attributes, and
    `vector(1536)` embedding columns.
-   Kept migration execution dependency-free; no ORM or migration runner
    was added because ordered `psql` commands are sufficient at this
    stage.
-   Did not add OpenAI integration, repositories, services, controllers,
    routes, Redis, BullMQ, matching logic, mismatch guard logic, or
    business logic.

## 2026-09-03 --- Stage 3 PostgreSQL application integration

-   AI-assisted implementation of the minimal PostgreSQL application
    access boundary.
-   Added the standard `pg` client and `@types/pg` declarations.
-   Added a module-level PostgreSQL pool under
    `src/infrastructure/database.ts` using required environment
    variables and credential-safe error handling.
-   Added a `SELECT 1` connectivity check and a standalone resource-safe
    verification script at `scripts/verify-database.mjs`.
-   Added the `verify:db` npm script; no ORM or migration runner was
    introduced.
-   Did not add repositories, services, routes, provider calls, queues,
    or application business logic.

## 2026-09-03 --- Stage 4 core repository/data-access layer

-   AI-assisted implementation of the bounded core data-access layer.
-   Added typed `ImageRepository` operations for create, find by ID,
    list, and processing-status update.
-   Added typed `PostRepository` operations for create, find by ID, and
    list.
-   Reused the existing shared PostgreSQL pool and used explicit columns
    with parameterized SQL throughout.
-   Added a standalone repository integration verification with unique
    test data and cleanup.
-   Did not modify migrations or add repositories for the other seven
    schema entities.
-   Did not add future-stage AI, matching, guard, queue, worker, HTTP,
    or application business logic.

## 2026-09-03 --- Stage 5 domain/application foundation

-   Added the typed provider-neutral `ImageMetadata` domain contract for
    validated image understanding output.
-   Added a deterministic mismatch guard with `ACCEPT`, `REJECT`, and
    `REVIEW` decisions plus the brief's machine-readable reason codes.
-   Centralized provisional semantic-similarity (`0.75`) and
    vision-confidence (`0.70`) thresholds in
    `src/domain/guard-policy.ts`; these require tuning against the
    labeled evaluation set.
-   Added the small `MatchingResult` and candidate-context contracts
    needed by a later orchestration stage without implementing
    orchestration.
-   Added focused Node built-in unit tests for guard outcomes, missing
    metadata, and threshold boundaries.
-   Did not add runtime provider validation, OpenAI, database access,
    repositories, embeddings, vector search, queues, HTTP, or business
    workflows.

## 2026-09-03 --- Stage 6 OpenAI vision provider

-   Added the official OpenAI Node.js SDK and Zod.
-   Added a focused OpenAI vision provider accepting an image URL and
    requesting strict structured output using `gpt-4.1-mini`.
-   Added provider-boundary Zod validation and normalization into the
    existing provider-neutral `ImageMetadata` domain type.
-   Classified provider/API failures separately from invalid model
    output; valid low-confidence output remains valid metadata.
-   Added offline unit tests for valid, invalid, and low-confidence
    structured responses without making a real API call.
-   Did not add embeddings, persistence changes, repository changes,
    vector search, queues, routes, matching orchestration, or AI usage
    tracking.

## 2026-09-03 --- Stage 7 OpenAI embedding provider

-   Added the focused OpenAI embedding provider using
    `text-embedding-3-small` and the fixed 1536-dimension embedding
    contract.
-   Added deterministic canonical text representations for image
    metadata and post title/content.
-   Added validation for embedding shape, exact dimension, finite
    numeric values, and provider/API error classification.
-   Added offline unit tests for canonical representations, valid
    output, invalid dimensions/values, low-level provider failures, and
    the fixed model constant.
-   Did not add embedding persistence, pgvector queries, repositories,
    matching, ranking, guard changes, queues, workers, cost tracking, or
    evaluation.

## 2026-09-03 --- Stage 8 embedding persistence/data access

-   Added focused image and post embedding repositories over the
    existing pgvector schema.
-   Added 1536-dimension finite-number validation and pgvector
    serialization/parsing inside the repository layer.
-   Added PostgreSQL-backed integration verification for embedding save,
    retrieval, missing records, invalid vectors, and cleanup.
-   Reused existing unique constraints and deliberately did not
    introduce an upsert policy.
-   Did not add migrations, dependencies, semantic search, similarity
    calculation, ranking, matching, queues, workers, or provider
    changes.

## 2026-09-03 --- Stage 9 semantic retrieval and ranking

-   Added exact pgvector cosine-distance retrieval for stored post
    embeddings and completed images with stored metadata.
-   Added a small application service that loads a post and its stored
    embedding before returning ranked image candidates.
-   Added the `GET /posts/:id/images` Express router with Zod UUID
    validation and safe HTTP error responses.
-   Added PostgreSQL-backed integration coverage for ranking, cosine
    similarity values, top-K behavior, metadata projection, and missing
    post embeddings.
-   Did not add guard integration, `NO_CONFIDENT_MATCH` decisions,
    OpenAI calls, ANN indexing, migrations, queues, workers, evaluation,
    or ranking beyond cosine-similarity order.

## 2026-09-03 --- Stage 10 deterministic mismatch guard integration

-   Connected ranked semantic candidates to the existing deterministic
    mismatch guard in the application service.
-   Selects the first ranked candidate whose guard decision is `ACCEPT`;
    rejected and reviewed candidates remain in `alternatives`.
-   Returns `NO_CONFIDENT_MATCH` with a null recommendation when no
    candidate is accepted.
-   Extended the existing `/posts/:id/images` response through the same
    route without persisting suggestions.
-   Added PostgreSQL-backed integration coverage for accepted
    candidates, subject mismatch, low vision confidence, no confident
    match, and selecting a lower-ranked accepted candidate.
-   Did not add OpenAI calls, suggestion persistence, review endpoints,
    queues, workers, evaluation, or threshold changes.

## 2026-09-03 --- Stage 11 persist matching suggestions

-   Added a typed `SuggestionRepository` for creating persisted
    evaluated candidates in the existing `suggestions` table.
-   Explicitly mapped domain guard decisions (`ACCEPT`, `REJECT`,
    `REVIEW`) to database statuses (`accept`, `reject`, `review`).
-   Updated the Stage 10 matching workflow to persist every evaluated
    candidate and return its `suggestionId`.
-   Preserved first-accepted recommendation selection and
    `NO_CONFIDENT_MATCH` behavior.
-   Added PostgreSQL-backed coverage for accepted, rejected, reviewed,
    and no-confident-match persistence.
-   Did not add migrations, review workflows, idempotency keys, or
    suggestion uniqueness constraints.

## 2026-09-03 --- Stage 12 review and human decision workflow

-   Added typed suggestion-context retrieval and review repositories
    over the existing `suggestions` and `reviews` tables.
-   Added application review operations for inspecting a suggestion and
    recording human `approved` or `rejected` decisions.
-   Added Zod-validated `GET /suggestions/:id`,
    `POST /suggestions/:id/approve`, and `POST /suggestions/:id/reject`
    routes.
-   Preserved `suggestions.guard_status`; human review decisions are
    recorded separately in `reviews`.
-   Added PostgreSQL-backed HTTP integration coverage for context
    retrieval, validation errors, approvals, rejections, existing
    reviews, and unchanged guard status.
-   Did not add authentication, review lifecycle rules, uniqueness
    constraints, migrations, or new tables.

## 2026-09-03 --- Stage 13 retrieval evaluation and quality measurement

-   Added a 10-record labeled post/image evaluation set and an
    entity-only local seed file.
-   Added `scripts/generate-evaluation-corpus.mjs`, which uses the
    existing `OpenAIEmbeddingProvider` and embedding repositories to
    generate and persist real `text-embedding-3-small` vectors.
-   Added pure evaluation metric calculation for baseline semantic top-1
    and guarded top-1 outcomes.
-   Added `scripts/evaluate-retrieval.mjs`, which uses persisted
    embeddings and makes no OpenAI calls during evaluation.
-   Added an evaluation test covering labeled-set loading and derived
    metrics.
-   The generator is available for fresh provider-backed corpus
    creation; this environment did not have an `OPENAI_API_KEY`, while
    the evaluator ran against the existing persisted fixture vectors.
-   Added a test-only integration wrapper that temporarily excludes only
    evaluation images and restores their original processing statuses in
    `finally`.
-   Did not add a new retrieval algorithm, matching entity, database
    table, or evaluation framework.

## 2026-09-03 --- Production similarity threshold calibration

-   Preserved the original provisional semantic similarity threshold of
    `0.75` in the calibration history.
-   Ran the experiment-only real-embedding sweep across `0.660` through
    `0.670`.
-   `0.660` and `0.661` achieved 10/10 guarded correctness with zero
    incorrect accepted matches; `0.662` achieved 9/10.
-   Selected the rounded `0.66` threshold for production as the highest
    practical rounded threshold supported by the current evidence.
-   The evidence is based on only 10 labeled evaluation posts and is not
    presented as universally optimal.
-   Changed only `GUARD_THRESHOLDS.minimumSemanticSimilarity`; the
    calibration mode remains available.

## 2026-09-03 --- Stage 14 AI usage and cost tracking

-   Inspected the installed OpenAI SDK declarations and mapped Responses
    `input_tokens`/`output_tokens` plus embeddings
    `prompt_tokens`/`total_tokens` into provider-neutral usage.
-   Extended vision and embeddings provider results with usage without
    exposing OpenAI SDK response types outside provider modules.
-   Added `AiUsageRepository` for creating and retrieving records in the
    existing `ai_usage` table.
-   Added isolated cost calculation with no pricing values configured
    until verified provider pricing is supplied.
-   Instrumented the existing evaluation corpus embedding call site;
    failed provider calls do not create successful usage records.
-   Added focused provider-usage, cost, repository-persistence, and
    mapping tests.
-   Did not modify the database schema or add budget guards, workers,
    dashboards, or a new production orchestration layer.

## 2026-09-04 --- Stage 15 asynchronous image processing infrastructure

-   Added the PostgreSQL job repository for tracking image-processing
    job lifecycle with queued, running, completed, and failed states.
-   Added Redis infrastructure using ioredis and added Redis to Docker
    Compose with a persistent volume and healthcheck.
-   Added a BullMQ `image-processing` queue with bounded retries,
    exponential backoff, and completed/failed job retention.
-   Added an application boundary for creating a database job and
    enqueueing the corresponding BullMQ job.
-   Added the image-processing worker with explicit startup and graceful
    shutdown handling.
-   Added worker error classification so retryable failures can be
    retried while permanent failures are marked failed without further
    BullMQ retries.
-   Added handling for malformed model output as a permanent processing
    failure.
-   Added integration tests covering queue creation, job lifecycle,
    worker completion, retry behavior, permanent failures, and
    retry-safe reuse of existing image processing state.
-   Kept job lifecycle ownership in the worker and avoided adding a
    generic job framework, dependency-injection container, outbox
    system, or distributed orchestration layer.
-   Verified the implementation with TypeScript, build, unit,
    integration, worker, retry, and formatting checks.

## 2026-09-06 --- Stage 16 image processing and ingestion

-   Added the image metadata repository to persist validated vision
    metadata and map database confidence values into the domain
    contract.
-   Added the image-processing application service to coordinate vision
    understanding, metadata persistence, image embedding generation, and
    embedding persistence.
-   Reused existing metadata and embeddings when available so retries do
    not unnecessarily repeat completed AI work.
-   Integrated the image-processing service into the BullMQ worker while
    keeping job lifecycle state changes owned by the worker.
-   Added integration tests covering successful worker processing, retry
    behavior, permanent failures, and reuse of existing processing
    state.
-   Added the `POST /images` ingestion route with Zod request
    validation.
-   The ingestion route creates the image record, creates and enqueues
    the background processing job, and returns without performing OpenAI
    processing in the HTTP request.
-   Added a minimal Express application/server entrypoint and registered
    the existing retrieval, review, and image-ingestion routers.
-   Added integration tests verifying invalid requests return `400` and
    valid requests create the image and corresponding PostgreSQL/BullMQ
    processing job.
-   When queue scheduling fails after image creation, the API reports
    that the image was created but processing could not be queued rather
    than incorrectly reporting that image creation failed.
-   No database schema changes were made during Stage 16.

## 2026-09-08 --- Stage 17 hardening and failure behavior

-   AI-assisted hardening review of the image-processing, retrieval,
    matching, ingestion, and review workflows against the Master Brief
    failure cases.
-   Added explicit parsing of malformed vision JSON so invalid model
    output is classified as `invalid_model_output` instead of being
    treated as a successful response.
-   Verified that provider/API failures remain separately classified as
    `provider_api_failure`, allowing the worker to retry transient
    provider failures.
-   Added integration coverage for provider failure, timeout, and
    rate-limit retry behavior using deterministic provider-boundary
    failure simulation rather than flaky live network tests.
-   Verified that permanent image-processing failures are surfaced to
    BullMQ as `UnrecoverableError`, preventing permanent failures from
    being retried by the queue.
-   Added coverage for repeated processing of an already-persisted
    image. Existing valid metadata and image embeddings are reused so
    completed AI work is not unnecessarily repeated.
-   Verified that completed images without an image embedding are
    excluded from semantic retrieval rather than producing an invalid
    candidate.
-   Verified deterministic low-confidence, mismatch, and
    `NO_CONFIDENT_MATCH` behavior through the existing guard and
    matching workflow tests.
-   Added API hardening coverage for invalid image-ingestion requests
    and invalid/unknown suggestion review actions.
-   Verified that repository/database errors are not swallowed and reach
    the API error boundary as HTTP 500 responses.
-   Preserved duplicate HTTP ingestion of the same source URL as
    currently supported behavior. The Stage 17 idempotency requirement
    is limited to safely reprocessing an existing persisted image; no
    `source_url` uniqueness constraint or duplicate-ingestion identity
    model was introduced.
-   Removed per-test closing of the shared PostgreSQL pool from
    integration tests so the full integration suite can run against the
    shared application database connection without interfering with
    subsequent tests.
-   No database schema or migration changes were made during Stage 17.
-   Final verification passed for TypeScript typechecking, build, unit
    tests, integration tests, image-ingestion tests, image-processing
    job/worker/retry tests, and `git diff --check`.

### Stage 18.2 --- AI budget guard

Added a small estimated AI spend budget guard using the existing
`ai_usage` records.

-   Added `AI_USAGE_BUDGET_USD` configuration with a default \$1
    development safety ceiling.
-   Added an aggregate estimated-cost query over completed AI usage
    records.
-   AI calls now check the accumulated estimated cost before both vision
    and embedding calls.
-   Calls are blocked once the configured budget has been reached.
-   Added focused unit tests for below-budget, boundary, over-budget,
    and invalid-budget behavior.
-   No database schema changes were required.

The budget is an estimated development safety ceiling, not an exact
provider billing limit.

## 2026-09-09 --- Provider configuration and Gemini Embedding 2 verification

-   Added a provider-neutral embedding configuration boundary supporting
    `EMBEDDING_PROVIDER=gemini` or `openai`.
-   Added the Gemini Embedding 2 provider using `gemini-embedding-2`
    with a fixed 1536-dimensional output, preserving compatibility with
    the existing `vector(1536)` database schema.
-   Preserved the existing OpenAI vision and embedding providers;
    provider selection is configuration-driven rather than hard-coded
    into the application service.
-   Added the local vision provider path for submission-safe execution.
    It loads pre-generated metadata from `data/corpus/metadata`,
    validates it with the existing Zod schema, and returns
    provider-neutral `ImageMetadata`.
-   Kept the current submission configuration at `VISION_PROVIDER=local`
    and `EMBEDDING_PROVIDER=gemini`, with OpenAI remaining available as
    an optional provider path.
-   Added Gemini pricing configuration at an estimated monetary cost of
    `$0`. The installed `@google/genai` runtime response does not expose
    embedding token usage, so Gemini usage records use zero unit values
    to represent unavailable usage rather than confirmed zero token
    consumption.
-   Updated image processing so the selected embedding provider and
    persisted embedding model are used consistently without changing
    repository or matching contracts.
-   Verified a real Gemini Embedding 2 call through
    `ImageProcessingService` using an existing image with validated
    metadata and no Gemini embedding. The service persisted the
    1536-dimensional vector and created a completed `ai_usage` record
    with provider `gemini`, model `gemini-embedding-2`, and estimated
    cost `0`.
-   Removed the unused Gemini usage-parser helper after confirming that
    the installed SDK does not expose the expected usage metadata.
-   `npm run typecheck` passed and the full unit suite passed after the
    provider cleanup.
-   No database schema or migration changes were made.

## 2026-09-10 --- Current evaluation calibration update
The earlier Stage 13 calibration selected a semantic similarity threshold of `0.66` using the evaluation configuration available at that time. That result is retained as historical build evidence.

After the embedding configuration was changed to Gemini Embedding 2 and the current 10-post labeled evaluation set was rerun, the threshold sweep was repeated. The current provisional threshold is `0.50`, which produced the strongest observed guarded result on the current corpus: 8/10 correct, 0 accepted incorrect matches, and 2 explicit `NO_CONFIDENT_MATCH` results.

The `0.50` threshold is empirical for the current corpus and embedding configuration. It must be re-tuned if the labeled evaluation set or embedding configuration changes.