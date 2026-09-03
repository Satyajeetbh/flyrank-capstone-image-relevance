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
