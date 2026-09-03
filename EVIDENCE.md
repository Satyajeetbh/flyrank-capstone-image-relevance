# Evidence

This file records commands used to verify the Stage 2 persistence foundation. Database commands require Docker Desktop to be running.

## PostgreSQL and migration verification

```bash
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

- PostgreSQL reports a healthy `postgres` service.
- The extension query returns `vector`.
- The table query returns `ai_usage`, `image_embeddings`, `image_metadata`, `images`, `jobs`, `post_embeddings`, `posts`, `reviews`, and `suggestions`.
- Constraint inspection includes primary keys, foreign keys, unique constraints, and check constraints.
- The vector-column query returns one `embedding` column for each embedding table with the pgvector type.

## TypeScript verification

```bash
npm run typecheck
npm run build
```

These commands complete successfully against the existing TypeScript foundation.

## Scope note

No OpenAI calls, application services, repositories, API routes, queues, matching logic, mismatch guard logic, authentication tables, match runs, subject taxonomy, or post-understanding pipeline were added.

## Stage 4 repository verification

The following commands were executed successfully against the running PostgreSQL container:

```bash
docker compose ps postgres
```

The PostgreSQL service reported `Up (healthy)` using the `pgvector/pgvector:pg16` image.

```bash
POSTGRES_HOST=localhost POSTGRES_PORT=5432 POSTGRES_DB=flyrank POSTGRES_USER=flyrank POSTGRES_PASSWORD=flyrank_local_password npm run verify:repositories
```

Result:

```text
Repository integration verification passed.
```

The verification created unique image and post records, retrieved each by ID, listed each entity, updated the image to `completed`, deleted the inserted records, and closed the shared pool.

TypeScript and diff verification also passed:

```bash
npm run typecheck
npm run build
git diff --check
```

## Stage 3 PostgreSQL application integration

The following commands were executed successfully:

```bash
docker compose ps postgres
```

Result:

```text
flyrank-capstone-image-relevance-postgres-1   pgvector/pgvector:pg16   Up 3 hours (healthy)   0.0.0.0:5432->5432/tcp
```

The application connectivity check was run with the documented local values:

```bash
POSTGRES_HOST=localhost POSTGRES_PORT=5432 POSTGRES_DB=flyrank POSTGRES_USER=flyrank POSTGRES_PASSWORD=flyrank_local_password npm run verify:db
```

Result:

```text
Database connectivity check passed.
```

The check builds the TypeScript module, executes `SELECT 1` through the shared pool, and closes the pool in a `finally` block. Failures return a non-zero exit code without logging credentials or raw database errors.

TypeScript verification also passed:

```bash
npm run typecheck
npm run build
```

## Stage 5 domain/application verification

The following commands were executed successfully:

```bash
npm run typecheck
npm run build
npm run test:unit
git diff --check
```

Results:

```text
TypeScript typecheck passed.
TypeScript build passed.
10 unit tests passed, 0 failed.
git diff --check passed with no whitespace errors.
```

The unit tests execute the compiled deterministic mismatch guard and cover acceptance, rejection, review, missing metadata, and both threshold boundaries. No PostgreSQL, provider, or application integration was added or required for Stage 5.

## Stage 6 OpenAI vision provider verification

The following commands were executed successfully:

```bash
npm run typecheck
npm run build
npm run test:unit
git diff --check
```

Results:

```text
TypeScript typecheck passed.
TypeScript build passed.
19 unit tests passed, 0 failed.
git diff --check passed with no whitespace errors.
```

The unit tests cover valid structured output, empty required fields, invalid attributes, out-of-range confidence, and valid low-confidence output. Tests use no real OpenAI API call. Live provider/API behavior remains unverified.

## Stage 7 OpenAI embedding provider verification

The following commands were executed successfully:

```bash
npm run typecheck
npm run build
npm run test:unit
git diff --check
```

The Stage 7 unit tests exercise deterministic image and post representations, valid embedding parsing, wrong dimensions, non-numeric values, non-finite values, provider failure classification, and the fixed model constant. No real OpenAI API call was made, and no embedding persistence or retrieval was exercised.

Results:

```text
TypeScript typecheck passed.
TypeScript build passed.
28 unit tests passed, 0 failed.
git diff --check passed with no whitespace errors.
```

## Stage 8 embedding persistence verification

The following command was executed successfully against the local PostgreSQL pgvector container:

```bash
POSTGRES_HOST=localhost POSTGRES_PORT=5432 POSTGRES_DB=flyrank POSTGRES_USER=flyrank POSTGRES_PASSWORD=flyrank_local_password npm run verify:embeddings
```

Result:

```text
1 integration test passed, 0 failed.
```

The verification created unique image and post records, saved and retrieved deterministic 1536-dimensional vectors, checked model and representative values with a tolerance, verified missing records return `null`, rejected invalid vectors before persistence, and cleaned up records in a `finally` block. No OpenAI call, vector search, or ranking was performed.

## Stage 9 semantic retrieval verification

The following commands were executed successfully:

```bash
npm run typecheck
npm run build
npm run test:unit
POSTGRES_HOST=localhost POSTGRES_PORT=5432 POSTGRES_DB=flyrank POSTGRES_USER=flyrank POSTGRES_PASSWORD=flyrank_local_password npm run test:integration
```

Results:

```text
TypeScript typecheck passed.
TypeScript build passed.
28 unit tests passed, 0 failed.
2 PostgreSQL integration tests passed, 0 failed.
```

The semantic retrieval integration test used deterministic local vectors to verify exact cosine-distance ordering, converted similarity values, top-K limits, candidate metadata, and the missing post-embedding path. It also verified that a completed candidate with `needs_review` metadata status is returned. It did not call OpenAI or invoke the mismatch guard.

## Stage 10 deterministic guard integration verification

The following commands were executed successfully:

```bash
npm run typecheck
npm run build
npm run test:unit
POSTGRES_HOST=localhost POSTGRES_PORT=5432 POSTGRES_DB=flyrank POSTGRES_USER=flyrank POSTGRES_PASSWORD=flyrank_local_password npm run test:integration
git diff --check
```

Results:

```text
TypeScript typecheck passed.
TypeScript build passed.
28 unit tests passed, 0 failed.
3 PostgreSQL integration tests passed, 0 failed.
git diff --check passed with no whitespace errors.
```

The Stage 10 integration test verified accepted-candidate recommendation, subject mismatch rejection, low-confidence review, `NO_CONFIDENT_MATCH`, ranked selection of a lower candidate accepted by the guard, and preservation of alternative guard decisions and reasons. No OpenAI call or suggestion persistence was performed.
