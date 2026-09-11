## 👋 Hello!

Thanks for taking the time to check out this project.

I’ve added a quick-start guide below to make it a little easier to get the project running, test the main functionality, and see the evaluation results without having to dig through the repository first.

The project is designed to be reproducible with the default configuration, while also keeping the real OpenAI provider implementations available for anyone who wants to try them.

### Reviewer quick start

If you want to evaluate the project quickly, follow this submission path.

### 1. Configure the environment

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

The submission configuration requires configuring `.env`:

```env
VISION_PROVIDER=local
EMBEDDING_PROVIDER=gemini
AI_USAGE_BUDGET_USD=1
GEMINI_API_KEY=your_gemini_api_key_here
```

> [!NOTE]
> The system requires an environment configuration. `VISION_PROVIDER=local` uses the checked-in, Zod-validated corpus metadata fixtures (avoiding OpenAI vision costs and API dependencies). For embeddings, `EMBEDDING_PROVIDER=gemini` requires a valid `GEMINI_API_KEY`. (Alternatively, set `EMBEDDING_PROVIDER=openai` with `OPENAI_API_KEY`).

### 2. Boot

```bash
docker compose up -d
```

This single command boots the complete system:
* **PostgreSQL 16 with pgvector**: automatically initializes extensions (`vector`, `pgcrypto`), core tables, constraints, and indexes from `migrations/` on first startup.
* **Redis 7**: queue and job persistence backend for asynchronous background processing.
* **API service**: Express HTTP application listening on `http://localhost:3000`.
* **Image-processing worker**: BullMQ worker handling asynchronous vision and embedding processing jobs.

### 3. Seed demo data

```bash
node --env-file=.env scripts/process-image-corpus.mjs
```

What this seed step does:
* Ingests the 50-image corpus defined in `data/corpus/manifest.json` into PostgreSQL (`processing_status = 'pending'`).
* Enqueues BullMQ processing jobs for each corpus image.
* The background worker extracts validated structured metadata (`LocalVisionProvider`), generates 1536-dimensional embeddings (`GeminiEmbeddingProvider`), and persists them to `image_embeddings`.
* Prepares the database with the complete searchable image corpus required for semantic retrieval and evaluation.

### 4. Run tests and evaluation

```bash
npm run typecheck
npm run test:unit
npm run test:integration
npm run evaluate:retrieval
```

To run the threshold calibration experiment:

```bash
npm run evaluate:retrieval:calibrate
```

### 5. Alternative local development setup (host-based)

If running the Node application directly on your host machine rather than inside Docker containers:

1. **Start infrastructure only**:
   ```bash
   docker compose up -d postgres redis
   ```
2. **Apply database migrations manually (if using an existing volume without initdb)**:
   ```bash
   docker compose exec -T postgres psql -U flyrank -d flyrank < migrations/001_enable_extensions.sql
   docker compose exec -T postgres psql -U flyrank -d flyrank < migrations/002_create_core_tables.sql
   docker compose exec -T postgres psql -U flyrank -d flyrank < migrations/003_create_indexes.sql
   ```
3. **Install dependencies and build**:
   ```bash
   npm ci
   npm run build
   ```
4. **Start API and worker on host**:
   ```bash
   npm start
   npm run worker:image-processing
   ```

### 6. Where to look

If you’d like to see how the core system works, these are the best places to start:

* `docs/DESIGN.md` — system design document
* `src/domain/mismatch-guard.ts` — deterministic image/post mismatch guard
* `src/domain/guard-policy.ts` — centralized guard thresholds
* `src/application/semantic-image-retrieval.ts` — semantic retrieval and matching workflow
* `src/application/image-processing.ts` — image understanding and embedding workflow
* `src/providers/openai-vision.ts` — OpenAI vision provider
* `src/providers/openai-embeddings.ts` — OpenAI embedding provider
* `src/providers/gemini-embeddings.ts` — Gemini embedding provider
* `src/workers/image-processing-worker.ts` — asynchronous image processing
* `data/evaluation/labeled-posts.json` — labeled evaluation set
* `scripts/evaluate-retrieval.mjs` — retrieval evaluation runner
* `EVIDENCE.md` — verification and evaluation evidence
* `BUILDLOG.md` — implementation history

The main engineering flow is:

```text
Image
  ↓
Vision / structured metadata
  ↓
Embedding
  ↓
Vector retrieval
  ↓
Deterministic mismatch guard
  ↓
Recommendation / Review / NO_CONFIDENT_MATCH
```

I hope this makes testing and exploring the project a little easier. Thanks again for taking the time to look through it.



# FlyRank AI Image Understanding & Content Matching Engine

This repository contains the TypeScript foundation, PostgreSQL
persistence layer, application data-access layer, provider-neutral image
metadata and matching contracts, OpenAI and local vision providers,
OpenAI and Gemini embedding providers, pgvector retrieval, deterministic
mismatch guarding, suggestion persistence and review, retrieval
evaluation, AI usage/cost tracking, asynchronous image processing, and
HTTP image ingestion for the FlyRank capstone project.

## Current scope

The project now includes PostgreSQL and pgvector persistence, typed
repositories, provider-neutral image metadata contracts, deterministic
mismatch guarding, configurable OpenAI/local vision providers,
configurable OpenAI/Gemini embedding providers, exact vector retrieval,
suggestion persistence and human review, labeled retrieval evaluation,
AI usage/cost tracking, asynchronous image processing through
Redis/BullMQ, and a minimal Express HTTP layer.

`POST /images` validates an image URL, creates the image record, creates
and enqueues background processing, and returns without performing
vision or embedding processing in the HTTP request.
`GET /posts/:id/images` performs semantic retrieval and deterministic
guard evaluation. Review endpoints allow human approval or rejection of
persisted suggestions.

The image-processing worker performs vision understanding, metadata
validation/persistence, image embedding, and embedding persistence
asynchronously.

The project still does not include a frontend, authentication, ANN
vector indexing, distributed infrastructure, or a generic service/DI
framework.

## Requirements

-   Node.js 20 or newer
-   npm
-   Docker Desktop with Compose

## Configuration

Copy `.env.example` to `.env` and adjust local values if needed:

-   `POSTGRES_HOST` --- database host used by local clients; defaults to
    `localhost`
-   `POSTGRES_PORT` --- exposed host port; defaults to `5432`
-   `POSTGRES_DB` --- database name; defaults to `flyrank`
-   `POSTGRES_USER` --- database user; defaults to `flyrank`
-   `POSTGRES_PASSWORD` --- local database password; defaults to
    `flyrank_local_password`
-   `OPENAI_API_KEY` --- required when using the OpenAI vision or OpenAI
    embedding provider
-   `GEMINI_API_KEY` --- required when using the Gemini embedding
    provider
-   `VISION_PROVIDER` --- `local` or `openai`; the submission-safe
    default is `local`
-   `EMBEDDING_PROVIDER` --- `gemini` or `openai`; the current
    submission configuration uses `gemini`
-   `AI_USAGE_BUDGET_USD` --- estimated development safety ceiling for
    accumulated AI usage

The current submission-safe configuration is:

``` env
VISION_PROVIDER=local
EMBEDDING_PROVIDER=gemini
AI_USAGE_BUDGET_USD=1
```

The local vision provider reads pre-generated, Zod-validated metadata
from `data/corpus/metadata` instead of making a live vision-model
request. This was chosen because the capstone requires a
\$0/no-credit-card path and the available free vision-provider options
were not reliable for this environment. The OpenAI vision provider
remains implemented as an optional real-provider path.

The embedding path uses Gemini Embedding 2 with 1536 dimensions,
matching the existing `vector(1536)` PostgreSQL schema. The OpenAI
embedding provider remains available as an alternative.

The installed `@google/genai` SDK does not expose embedding token usage
in the runtime response used by this project. Gemini embedding usage is
therefore recorded with zero unit values to represent unavailable usage,
not confirmed zero token consumption, and its configured estimated
monetary cost is `$0`.

The Compose file uses the same database variables with local defaults.
`.env` is ignored by Git. Never commit API keys.

## Start PostgreSQL and Redis

``` bash
docker compose up -d postgres redis
```

The service uses the `pgvector/pgvector:pg16` image and a persistent
named volume named `postgres_data`.

## Apply migrations

Migrations are plain SQL and are intentionally kept dependency-free.
When starting with `docker compose up -d`, `migrations/` is mounted into
`/docker-entrypoint-initdb.d:ro` so fresh databases initialize automatically
on startup.

To apply or re-run them manually from the repository root after PostgreSQL
is healthy:

The commands below use the documented local defaults. If you override
the database name or user, replace `flyrank` in the commands
accordingly:

``` bash
docker compose exec -T postgres psql -U flyrank -d flyrank < migrations/001_enable_extensions.sql
docker compose exec -T postgres psql -U flyrank -d flyrank < migrations/002_create_core_tables.sql
docker compose exec -T postgres psql -U flyrank -d flyrank < migrations/003_create_indexes.sql
```

The migrations are safe to re-run on a clean or already initialized
development database through `IF NOT EXISTS` guards.

## Verify PostgreSQL and pgvector

``` bash
docker compose ps postgres
docker compose exec -T postgres psql -U flyrank -d flyrank -c "SELECT extname FROM pg_extension WHERE extname = 'vector';"
docker compose exec -T postgres psql -U flyrank -d flyrank -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;"
docker compose exec -T postgres psql -U flyrank -d flyrank -c "SELECT table_name, column_name, udt_name FROM information_schema.columns WHERE table_name IN ('image_embeddings', 'post_embeddings') AND column_name = 'embedding' ORDER BY table_name;"
```

## Application database check

The infrastructure database module requires `POSTGRES_HOST`,
`POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, and
`POSTGRES_PASSWORD`. Set these variables in the shell before running the
check; `.env` is not loaded automatically by Node.

``` bash
npm run verify:db
```

The command builds the TypeScript source, executes `SELECT 1` through
the shared pool, and closes the pool. It exits non-zero if configuration
is missing or PostgreSQL is unreachable.

## Guard policy

The deterministic mismatch guard uses a provisional semantic similarity
threshold of `0.50` and a vision-confidence threshold of `0.70`. The
semantic similarity threshold was selected from the current 10-post
labeled evaluation set: `0.50` produced 8/10 baseline accuracy, 9/10 guarded correctness with
zero incorrectly accepted matches and one `NO_CONFIDENT_MATCH`. These
thresholds are corpus- and embedding-configuration-specific and should
be re-tuned when the labeled evaluation set or embedding configuration
changes. Both values are centralized in `src/domain/guard-policy.ts`.

The guard returns `REVIEW` with `MISSING_METADATA` when required
subject, category, or vision-confidence data is absent. A candidate
without a usable similarity score returns `REJECT` with
`NO_USABLE_CANDIDATE`. Accepted results have no failure reason code
(`null`).

## Repository verification

After PostgreSQL is running and migrations have been applied, set the
required database variables and run:

``` bash
npm run verify:repositories
```

The verification creates unique image and post rows, retrieves and lists
them, updates the image processing status, and removes the inserted rows
afterward.

## Unit tests

``` bash
npm run test:unit
```

The unit tests execute the compiled deterministic guard and OpenAI
provider parsing boundary with Node's built-in test runner. They do not
call the real OpenAI API.

## OpenAI vision provider

The provider accepts an image URL and requests structured
image-understanding output from the configured OpenAI vision-capable
model. Zod validates and normalizes the response into provider-neutral
`ImageMetadata` before it reaches the domain layer.

Provider/API failures and invalid model output are classified
separately. Valid low-confidence metadata remains valid output; the
deterministic mismatch guard remains responsible for deciding whether it
should be accepted, rejected, or reviewed. Embeddings are intentionally
not part of Stage 6.

The selected model is `gpt-4.1-mini`, defined in
`src/providers/openai-vision.ts` so it can be changed in a later stage
without introducing model-selection infrastructure.

## OpenAI embedding provider

The original embedding provider uses the fixed `text-embedding-3-small`
model and validates exactly 1536 finite numeric values. It accepts image
metadata or a post title/content input and returns `number[]`; it does
not persist or search vectors.

The project also provides a provider-neutral embedding boundary so the
application can select either OpenAI or Gemini without changing
repository or matching code.

Canonical image representation:

``` text
Subject: <subject>
Category: <category>
Attributes: <comma-separated attributes>
Caption: <caption>
```

Canonical post representation:

``` text
Title: <title>
Content: <content>
```

Provider/API failures are classified as `provider_api_failure`;
malformed or incorrectly sized embedding responses are classified
separately as invalid provider output. No real API call is required by
the unit tests.

## Embedding persistence

`ImageEmbeddingRepository` and `PostEmbeddingRepository` save and
retrieve `number[]` vectors through the existing `image_embeddings` and
`post_embeddings` tables. The repositories validate exactly 1536 finite
numeric values, serialize writes as parameterized pgvector literals, and
parse `embedding::text` reads back into `number[]`.

The existing unique constraints on `(image_id, embedding_model)` and
`(post_id, embedding_model)` reject duplicate writes. No upsert policy,
semantic retrieval, similarity calculation, or ranking is implemented.

Run the PostgreSQL-backed embedding verification with the required
database variables set:

``` bash
npm run verify:embeddings
```

## Retrieval evaluation

The evaluation dataset is stored in `data/evaluation/labeled-posts.json`
and contains 10 labeled post/image pairs.

### Evaluation corpus

The labeled evaluation set is defined in
`data/evaluation/labeled-posts.json`. Each entry references a stable
corpus image ID, and the evaluation script resolves that ID to the
current database image record through its `storageReference`.

Run the current retrieval evaluation with:

``` bash
npm run evaluate:retrieval
```

The evaluator reports baseline top-1 accuracy from the
highest-similarity candidate and guarded top-1 accuracy from the
existing matching workflow. It also reports no-confident-match count,
accepted incorrect matches, and expected images retrieved but rejected
by the guard. The experiment-only calibration mode reports threshold
sweeps without changing production configuration.

The current deterministic guard uses a provisional semantic similarity
threshold of `0.50` and a vision-confidence threshold of `0.70`. With
the current Gemini Embedding 2 configuration and 10-post labeled
evaluation set, the `0.50` threshold produced 9/10 guarded correctness,
zero incorrectly accepted matches, and one `NO_CONFIDENT_MATCH`. The
threshold is corpus- and embedding-configuration-specific and should be
re-tuned when the labeled evaluation set or embedding configuration
changes.

Evaluation does not call OpenAI or persist evaluation tables.

Run threshold calibration with:

``` bash
npm run evaluate:retrieval:calibrate
```

## AI usage and cost tracking

The AI usage layer maps provider usage into the existing `ai_usage`
table for provider calls made by application workflows. OpenAI vision
usage maps Responses API `input_tokens` and `output_tokens`; OpenAI
embedding usage maps its reported prompt-token usage. Gemini Embedding 2
currently returns no usage metadata through the installed SDK, so Gemini
embedding records use zero unit values to represent unavailable usage
and are configured with an estimated cost of `$0`. Failed provider calls
are not recorded as successful usage.

The application also checks the accumulated estimated cost before vision
and embedding calls against `AI_USAGE_BUDGET_USD`. This is a development
safety ceiling, not an exact provider billing limit.

## Asynchronous image processing

Image processing is executed asynchronously through Redis and BullMQ
rather than inside the HTTP request path.

The processing flow is:

``` text
Image processing job
       ↓
BullMQ / Redis
       ↓
Image processing worker
       ↓
Vision provider
       ↓
Validated image metadata
       ↓
Image embedding
       ↓
PostgreSQL persistence
```

## Image processing and ingestion

The image-processing workflow connects the existing vision, embedding,
persistence, and asynchronous job components.

Image processing flow:

``` text
POST /images
   ↓
Validate request with Zod
   ↓
Create image record
   ↓
Create PostgreSQL processing job
   ↓
Enqueue BullMQ job
   ↓
Return HTTP 201
   ↓
Worker processes image asynchronously
   ↓
Configured vision provider → metadata → configured embedding provider
   ↓
PostgreSQL persistence
```

## Hardening and failure behavior

The image-processing and matching workflows include deterministic
failure handling for the main failure cases identified in the project
brief.

### AI/provider failures

Vision provider failures are classified separately from invalid model
output:

``` text
Provider/API failure
        ↓
provider_api_failure
        ↓
Retryable worker failure
        ↓
BullMQ retry
```

Invalid structured model output is classified separately and is not
treated as successful metadata.

### TypeScript verification

``` bash
npm run typecheck
npm run build
```

### AI usage budget

AI usage is tracked per provider call using provider-reported usage
where available and configured estimated pricing. Gemini Embedding 2
currently has unavailable runtime token metadata, so its usage units are
recorded as zero with a documented `$0` estimated cost.

The application also enforces an estimated AI spend budget before making
vision or embedding calls. Configure it with:

``` env
AI_USAGE_BUDGET_USD=1
```

### Final verification

``` powershell
npm run typecheck
npm run build
npm run test:unit
npm run test:integration
git diff --check
```

## AI provider configuration

The provider boundaries are intentionally swappable without changing the
application service or persistence layer.

  Capability   Option     Current configuration
  ------------ ---------- -----------------------
  Vision       `local`    `local`
  Vision       `openai`   optional
  Embeddings   `gemini`   `gemini`
  Embeddings   `openai`   optional

For the capstone's submission-safe path, use:

``` env
VISION_PROVIDER=local
EMBEDDING_PROVIDER=gemini
AI_USAGE_BUDGET_USD=1
```

With `VISION_PROVIDER=local`, image-understanding metadata is loaded
from the checked-in corpus metadata and validated with the same domain
schema used at the provider boundary. With `EMBEDDING_PROVIDER=gemini`,
the application makes real Gemini Embedding 2 calls and persists
1536-dimensional vectors in the existing pgvector columns.

## Repository layout

-   `src/api` --- HTTP route handlers and transport validation
-   `src/application` --- application workflows and orchestration
    boundaries
-   `src/domain` --- provider-neutral domain contracts and deterministic
    business rules
-   `src/infrastructure` --- PostgreSQL and Redis/BullMQ infrastructure
-   `src/jobs` --- background-job-related application space
-   `src/providers` --- external AI provider boundaries
-   `src/repositories` --- PostgreSQL persistence boundaries
-   `src/schemas` --- reserved for shared schemas where needed
-   `src/workers` --- asynchronous BullMQ workers
-   `tests/unit` --- focused unit tests
-   `tests/integration` --- PostgreSQL, Redis, queue, worker, and HTTP
    integration tests
-   `tests/evaluation` --- evaluation tests and fixtures
-   `scripts` --- project maintenance and evaluation scripts
-   `data/seed` --- seed data
-   `data/evaluation` --- evaluation data
-   `migrations` --- versioned SQL migrations
-   `docs` --- project documentation

See `BUILDLOG.md` for implementation history and `EVIDENCE.md` for
recorded verification evidence.
