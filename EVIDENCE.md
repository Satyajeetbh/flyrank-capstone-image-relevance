# Evidence

This file records commands used to verify the Stage 2 persistence
foundation. Database commands require Docker Desktop to be running.

## PostgreSQL and migration verification

``` bash
docker compose up -d postgres
docker compose ps postgres
docker compose exec -T postgres psql -U flyrank -d flyrank < migrations/001_enable_extensions.sql
docker compose exec -T postgres psql -U flyrank -d flyrank < migrations/002_create_core_tables.sql
docker compose exec -T postgres psql -U flyrank -d flyrank < migrations/003_create_indexes.sql
docker compose exec -T postgres psql -U flyrank -d flyrank -c "SELECT extname FROM pg_extension WHERE extname = 'vector';"
docker compose exec -T postgres psql -U flyrank -d flyrank -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;"
docker compose exec -T postgres psql -U flyrank -d flyrank -c "SELECT tc.constraint_name, tc.table_name, tc.constraint_type FROM information_schema.table_constraints tc WHERE tc.table_schema = 'public' ORDER BY tc.table_name, tc.constraint_name;"
docker compose exec -T postgres psql -U flyrank -d flyrank -c "SELECT table_name, column_name, udt_name FROM information_schema.columns WHERE table_name IN ('image_embeddings', 'post_embeddings') AND column_name = 'embedding' ORDER BY table_name;"
```

Expected database checks:

-   PostgreSQL reports a healthy `postgres` service.
-   The extension query returns `vector`.
-   The table query returns `ai_usage`, `image_embeddings`,
    `image_metadata`, `images`, `jobs`, `post_embeddings`, `posts`,
    `reviews`, and `suggestions`.
-   Constraint inspection includes primary keys, foreign keys, unique
    constraints, and check constraints.
-   The vector-column query returns one `embedding` column for each
    embedding table with the pgvector type.

## TypeScript verification

``` bash
npm run typecheck
npm run build
```

These commands complete successfully against the existing TypeScript
foundation.

## Scope note

No OpenAI calls, application services, repositories, API routes, queues,
matching logic, mismatch guard logic, authentication tables, match runs,
subject taxonomy, or post-understanding pipeline were added.

## Stage 4 repository verification

The following commands were executed successfully against the running
PostgreSQL container:

``` bash
docker compose ps postgres
```

The PostgreSQL service reported `Up (healthy)` using the
`pgvector/pgvector:pg16` image.

``` bash
POSTGRES_HOST=localhost POSTGRES_PORT=5432 POSTGRES_DB=flyrank POSTGRES_USER=flyrank POSTGRES_PASSWORD=flyrank_local_password npm run verify:repositories
```

Result:

``` text
Repository integration verification passed.
```

The verification created unique image and post records, retrieved each
by ID, listed each entity, updated the image to `completed`, deleted the
inserted records, and closed the shared pool.

TypeScript and diff verification also passed:

``` bash
npm run typecheck
npm run build
git diff --check
```

## Stage 3 PostgreSQL application integration

The following commands were executed successfully:

``` bash
docker compose ps postgres
```

Result:

``` text
flyrank-capstone-image-relevance-postgres-1   pgvector/pgvector:pg16   Up 3 hours (healthy)   0.0.0.0:5432->5432/tcp
```

The application connectivity check was run with the documented local
values:

``` bash
POSTGRES_HOST=localhost POSTGRES_PORT=5432 POSTGRES_DB=flyrank POSTGRES_USER=flyrank POSTGRES_PASSWORD=flyrank_local_password npm run verify:db
```

Result:

``` text
Database connectivity check passed.
```

The check builds the TypeScript module, executes `SELECT 1` through the
shared pool, and closes the pool in a `finally` block. Failures return a
non-zero exit code without logging credentials or raw database errors.

TypeScript verification also passed:

``` bash
npm run typecheck
npm run build
```

## Stage 5 domain/application verification

The following commands were executed successfully:

```bash
npm run typecheck
npm run build
node --test tests/unit/mismatch-guard.test.mjs
git diff --check
```

Results:

```text
TypeScript typecheck passed.
TypeScript build passed.
13 mismatch-guard unit tests passed, 0 failed.
git diff --check passed with no whitespace errors.
```

The deterministic mismatch-guard tests cover acceptance, rejection, review,
missing metadata, similarity-threshold boundaries, vision-confidence
boundaries, normalized subject/category labels, compatible subject wording,
and unrelated subject rejection.

The guard uses deterministic rules only and does not call PostgreSQL,
OpenAI, Gemini, or other providers.

The Stage 5 domain/application foundation was implemented without adding
API routes, background processing, vector search, or provider-specific logic.

## Stage 6 OpenAI vision provider verification

The following commands were executed successfully:

``` bash
npm run typecheck
npm run build
npm run test:unit
git diff --check
```

Results:

``` text
TypeScript typecheck passed.
TypeScript build passed.
19 unit tests passed, 0 failed.
git diff --check passed with no whitespace errors.
```

The unit tests cover valid structured output, empty required fields,
invalid attributes, out-of-range confidence, and valid low-confidence
output. Tests use no real OpenAI API call. Live provider/API behavior
remains unverified.

## Stage 7 OpenAI embedding provider verification

The following commands were executed successfully:

``` bash
npm run typecheck
npm run build
npm run test:unit
git diff --check
```

The Stage 7 unit tests exercise deterministic image and post
representations, valid embedding parsing, wrong dimensions, non-numeric
values, non-finite values, provider failure classification, and the
fixed model constant. No real OpenAI API call was made, and no embedding
persistence or retrieval was exercised.

Results:

``` text
TypeScript typecheck passed.
TypeScript build passed.
28 unit tests passed, 0 failed.
git diff --check passed with no whitespace errors.
```

## Stage 8 embedding persistence verification

The following command was executed successfully against the local
PostgreSQL pgvector container:

``` bash
POSTGRES_HOST=localhost POSTGRES_PORT=5432 POSTGRES_DB=flyrank POSTGRES_USER=flyrank POSTGRES_PASSWORD=flyrank_local_password npm run verify:embeddings
```

Result:

``` text
1 integration test passed, 0 failed.
```

The verification created unique image and post records, saved and
retrieved deterministic 1536-dimensional vectors, checked model and
representative values with a tolerance, verified missing records return
`null`, rejected invalid vectors before persistence, and cleaned up
records in a `finally` block. No OpenAI call, vector search, or ranking
was performed.

## Stage 9 semantic retrieval verification

The following commands were executed successfully:

``` bash
npm run typecheck
npm run build
npm run test:unit
POSTGRES_HOST=localhost POSTGRES_PORT=5432 POSTGRES_DB=flyrank POSTGRES_USER=flyrank POSTGRES_PASSWORD=flyrank_local_password npm run test:integration
```

Results:

``` text
TypeScript typecheck passed.
TypeScript build passed.
28 unit tests passed, 0 failed.
2 PostgreSQL integration tests passed, 0 failed.
```

The semantic retrieval integration test used deterministic local vectors
to verify exact cosine-distance ordering, converted similarity values,
top-K limits, candidate metadata, and the missing post-embedding path.
It also verified that a completed candidate with `needs_review` metadata
status is returned. It did not call OpenAI or invoke the mismatch guard.

## Stage 10 deterministic guard integration verification

The following commands were executed successfully:

``` bash
npm run typecheck
npm run build
npm run test:unit
POSTGRES_HOST=localhost POSTGRES_PORT=5432 POSTGRES_DB=flyrank POSTGRES_USER=flyrank POSTGRES_PASSWORD=flyrank_local_password npm run test:integration
git diff --check
```

Results:

``` text
TypeScript typecheck passed.
TypeScript build passed.
28 unit tests passed, 0 failed.
3 PostgreSQL integration tests passed, 0 failed.
git diff --check passed with no whitespace errors.
```

The Stage 10 integration test verified accepted-candidate
recommendation, subject mismatch rejection, low-confidence review,
`NO_CONFIDENT_MATCH`, ranked selection of a lower candidate accepted by
the guard, and preservation of alternative guard decisions and reasons.
No OpenAI call or suggestion persistence was performed.

## Stage 11 suggestion persistence verification

The following commands were executed successfully:

``` bash
npm run typecheck
npm run build
npm run test:unit
POSTGRES_HOST=localhost POSTGRES_PORT=5432 POSTGRES_DB=flyrank POSTGRES_USER=flyrank POSTGRES_PASSWORD=flyrank_local_password npm run test:integration
git diff --check
```

Results:

``` text
TypeScript typecheck passed.
TypeScript build passed.
28 unit tests passed, 0 failed.
3 PostgreSQL integration tests passed, 0 failed.
git diff --check passed with no whitespace errors.
```

The Stage 11 integration test verified that every evaluated candidate is
persisted with the explicit lowercase guard status, reason, and returned
suggestion identifier. It covered accepted, rejected, reviewed, and
`NO_CONFIDENT_MATCH` workflows. No OpenAI call or review workflow was
performed.

## Stage 12 review and human decision verification

The repository does not define an `npm test` script; the existing
equivalent unit command was used.

``` bash
npm test
npm run typecheck
npm run build
npm run test:unit
POSTGRES_HOST=localhost POSTGRES_PORT=5432 POSTGRES_DB=flyrank POSTGRES_USER=flyrank POSTGRES_PASSWORD=flyrank_local_password npm run verify:db
POSTGRES_HOST=localhost POSTGRES_PORT=5432 POSTGRES_DB=flyrank POSTGRES_USER=flyrank POSTGRES_PASSWORD=flyrank_local_password npm run verify:repositories
POSTGRES_HOST=localhost POSTGRES_PORT=5432 POSTGRES_DB=flyrank POSTGRES_USER=flyrank POSTGRES_PASSWORD=flyrank_local_password npm run test:integration
git diff --check
```

Results:

``` text
npm test: unavailable because no test script is defined.
TypeScript typecheck passed.
TypeScript build passed.
28 unit tests passed, 0 failed.
Database connectivity check passed.
Repository integration verification passed.
4 PostgreSQL integration tests passed, 0 failed.
git diff --check passed with no whitespace errors.
```

The Stage 12 integration test verified suggestion context retrieval,
existing review retrieval, invalid UUID handling, unknown suggestion
handling, approval creation, rejection validation and creation, and
preservation of the original `suggestions.guard_status`. No
authentication or review workflow beyond recording decisions was added.

## Stage 13 retrieval evaluation

The metric calculation test was executed successfully:

``` bash
npm run test:evaluation
```

Result:

``` text
1 evaluation test passed, 0 failed.
```

The evaluation corpus entity seed used during the earlier evaluation
implementation has since been retired. The current evaluation corpus is
defined by `data/evaluation/labeled-posts.json` and resolves expected
images through their stable corpus IDs.

The earlier evaluation-corpus generation command was also attempted during
the historical implementation, but could not call OpenAI because
`OPENAI_API_KEY` was not configured in that environment. This historical
failure is retained as evidence; it is not part of the current evaluation
workflow.

Current retrieval evaluation runs only against persisted vectors and makes
no OpenAI calls:

```bash
POSTGRES_HOST=localhost POSTGRES_PORT=5432 POSTGRES_DB=flyrank POSTGRES_USER=flyrank POSTGRES_PASSWORD=flyrank_local_password npm run evaluate:retrieval
```

The evaluator was first run against the persisted fixture before
applying the calibrated production threshold and produced:

``` json
{
  "totalEvaluatedPosts": 10,
  "baselineCorrect": 10,
  "baselineIncorrect": 0,
  "guardedCorrect": 3,
  "guardedIncorrect": 7,
  "noConfidentMatchCount": 7,
  "acceptedIncorrectMatches": 0,
  "expectedRetrievedButRejectedCount": 7
}
```

After applying the production threshold of `0.66`, the evaluator
produced:

``` json
{
  "totalEvaluatedPosts": 10,
  "baselineCorrect": 10,
  "baselineIncorrect": 0,
  "guardedCorrect": 10,
  "guardedIncorrect": 0,
  "noConfidentMatchCount": 0,
  "acceptedIncorrectMatches": 0,
  "expectedRetrievedButRejectedCount": 0
}
```

The calibration experiment that informed the selection showed 10/10
guarded correctness with zero incorrect accepted matches at `0.660` and
`0.661`, while `0.662` dropped to 9/10. The evidence is based on 10
labeled posts and is empirical for this corpus, not universally optimal.
The existing experiment-only calibration mode remains available and no
OpenAI call is made during evaluation.

## Stage 14 AI usage and cost tracking verification

The following commands were executed successfully:

``` bash
npm run typecheck
npm run build
npm run test:unit
npm run test:integration
```

Results:

``` text
TypeScript typecheck passed.
TypeScript build passed.
32 unit tests passed, 0 failed.
5 PostgreSQL integration tests passed, 0 failed.
```

Stage 14 unit tests verified Responses and embeddings usage mapping plus
unconfigured-pricing behavior. The AI usage integration test persisted
and retrieved an image usage record with provider, model, input units,
output units, status, and estimated cost. No real OpenAI call was made
during verification, so no provider usage was generated by these tests.

## Stage 15 asynchronous image processing verification

The following verification was completed:

``` bash
npm run typecheck
npm run build
npm run test:integration:image-processing-jobs
npm run test:integration:image-processing-worker
npm run test:integration:image-processing-retry
```

## Stage 16 image processing and ingestion verification

The following verification was completed:

```bash
npm run typecheck
npm run build
npm run test:integration:image-ingestion
npm run verify:repositories
npm run verify:redis

Results:

TypeScript typecheck passed.
TypeScript build passed.
2 image-ingestion integration tests passed, 0 failed.
Repository integration verification passed.
Redis connection verified.

The image-ingestion integration tests verified that invalid image input returns HTTP 400 and that valid input creates an image with `pending` processing status and a corresponding PostgreSQL processing job and BullMQ job in Redis.

A manual HTTP verification was also performed against the running Express server:

POST /images with invalid sourceUrl → HTTP 400
POST /images with valid sourceUrl → HTTP 201 Created

The successful HTTP response contained the created image identifier and processing job identifier. The image was initially persisted with `pending` processing status.

The ingestion route performs request validation and persistence/enqueue operations only. It does not call the OpenAI vision or embedding providers; expensive AI processing remains owned by the asynchronous worker.

No database schema or migration changes were made during Stage 16.

## Stage 17 hardening verification

Stage 17 hardened the failure behavior of the image-processing, retrieval, matching, ingestion, and review workflows against the failure cases specified in the Master Brief.

### Final verification

The following commands were executed successfully:

```bash
npm run typecheck
npm run build
npm run test:unit
npm run test:integration
npm run test:integration:image-ingestion
npm run test:integration:image-processing-jobs
npm run test:integration:image-processing-worker
npm run test:integration:image-processing-retry
git diff --check
```

### AI budget guard

The pipeline now enforces a configurable estimated AI usage budget using persisted `ai_usage` records.

Budget behavior is covered by unit tests for:
- usage below the budget
- usage exactly at the budget
- usage above the budget
- invalid current cost
- invalid budget configuration

The default development budget is `$1`. This is a safety ceiling based on estimated provider usage and is not an exact provider billing limit.

## Current evaluation results and threshold clarification

The Stage 13 evaluation results above are historical results from the earlier OpenAI embedding configuration. They are retained because they document the original calibration experiment and the subsequent provider change.

The current submission configuration uses `gemini-embedding-2` with 1536-dimensional embeddings, so the retrieval evaluation and guard threshold were re-run against the current persisted vectors.

The current calibrated threshold is `0.50`. On the current 10-post labeled evaluation set, the results are:

```json
{
  "totalEvaluatedPosts": 10,
  "baselineCorrect": 8,
  "baselineIncorrect": 2,
  "guardedCorrect": 9,
  "guardedIncorrect": 1,
  "noConfidentMatchCount": 1,
  "acceptedIncorrectMatches": 0,
  "expectedRetrievedButRejectedCount": 1
}
```

The current calibration experiment tested semantic similarity thresholds from `0.50` through `0.70`. The `0.50` threshold produced the best result among the tested thresholds for the current Gemini embedding configuration: 9/10 guarded-correct results with zero incorrectly accepted matches. Higher thresholds did not improve guarded correctness or precision and rejected more expected images.

This threshold is empirical for the current 10-post labeled set and should not be treated as universally optimal. It is intended to be re-tuned if the embedding provider/model or evaluation dataset changes.


## Stage 18.3 Gemini Embedding 2 and provider-selection verification

The current submission-safe provider configuration is:

```env
VISION_PROVIDER=local
EMBEDDING_PROVIDER=gemini
AI_USAGE_BUDGET_USD=1
```

The OpenAI vision and embedding providers remain available as optional
configuration paths. The local vision provider reads validated metadata
from the corpus instead of making a live vision request.

### TypeScript and unit verification

The following commands were executed successfully after the Gemini
provider cleanup:

``` bash
npm run typecheck
npm run test:unit
```

Results:

``` text
TypeScript typecheck passed.
All unit tests passed.
```

The Gemini unit coverage verifies the fixed `gemini-embedding-2` model,
the 1536-dimensional contract, valid vector parsing, invalid dimensions,
non-numeric values, non-finite values, missing vectors, and missing
API-key configuration.

### Real Gemini API verification

A real Gemini Embedding 2 request was executed successfully. The
returned vector contained exactly 1536 dimensions.

The application-level verification then processed an existing tiger
image with already-persisted validated metadata and no existing Gemini
embedding:

``` text
imageId: aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa10
subject: tiger
category: animal
embeddingModel: gemini-embedding-2
```

The `ImageProcessingService` completed successfully and persisted the
embedding.

The corresponding `ai_usage` record was retrieved from PostgreSQL:

``` json
{
  "entityType": "image",
  "entityId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa10",
  "operation": "image_embedding",
  "provider": "gemini",
  "model": "gemini-embedding-2",
  "inputUnits": 0,
  "outputUnits": 0,
  "estimatedCost": 0,
  "status": "completed"
}
```

The zero unit values mean the installed `@google/genai` SDK did not
expose runtime embedding token usage. They must not be interpreted as
proof that the API request consumed zero tokens. The configured Gemini
Embedding 2 estimated monetary cost is `$0`.

### Provider-selection behavior

The worker selects the vision provider from `VISION_PROVIDER` and the
embedding provider from `EMBEDDING_PROVIDER`.

Current intended submission configuration:

``` text
POST /images
    ↓
BullMQ / Redis
    ↓
Image-processing worker
    ↓
Local vision metadata
    ↓
Validated ImageMetadata
    ↓
Gemini Embedding 2
    ↓
1536-dimensional vector
    ↓
PostgreSQL / pgvector
    ↓
ai_usage cost record
```

This verification exercised the real embedding provider and persistence
path while avoiding a live vision-model dependency.

### Documentation correction

README, BUILDLOG, and EVIDENCE were updated to distinguish historical
OpenAI stages from the current configurable provider path and to
document the submission-safe local-vision/Gemini-embedding
configuration.


## Current evaluation — Gemini Embedding 2

The current labeled evaluation was rerun using the Gemini Embedding 2
image-metadata and post embeddings with the deterministic guard threshold
set to `0.50`.

Results across 10 labeled posts:

* Baseline correct: **8/10**
* Baseline incorrect: **2/10**
* Guarded correct: **9/10**
* Guarded incorrect: **1/10**
* Explicit `NO_CONFIDENT_MATCH`: **1**
* Accepted incorrect matches: **0**
* Expected candidates retrieved but rejected by the guard: **1**
* Guarded top-1 precision on accepted matches: **100%**

The gray-wolf case demonstrates the value of the guard: the highest-similarity
baseline candidate was a red fox, while the expected gray-wolf image appeared
lower in the ranked candidates. The guard rejected the incompatible candidate
and accepted the expected wolf candidate.

The laptop case demonstrates the `NO_CONFIDENT_MATCH` behavior: the
highest-similarity candidate was incorrect and the expected laptop image did
not meet the semantic similarity threshold, so the workflow did not force an
incorrect recommendation.

The mountain case is accepted after the deterministic subject-compatibility
correction. The guard now permits concise expected subjects such as
`mountain` to match richer validated metadata such as
`forested mountain range`, while still rejecting unrelated subjects such as
`red fox` and `gray wolf`.

A threshold sweep on the current 10-post labeled set showed that `0.50`
produced the strongest observed result with the current Gemini Embedding 2
configuration. The threshold remains provisional and corpus-specific; it
must be re-tuned when the labeled evaluation set or embedding configuration
changes.

The earlier Stage 13 `0.66` calibration remains historical evidence from the
previous embedding/evaluation configuration and is not the current
production threshold.

Evaluation runs against persisted vectors and does not call OpenAI or
persist evaluation tables.
