# Build Log

## 2026-09-03 — Stage 2 PostgreSQL persistence

- AI-assisted implementation of the PostgreSQL persistence foundation.
- Added a PostgreSQL 16 pgvector Compose service with configurable local database credentials, a persistent named volume, port mapping, and healthcheck.
- Recorded the authoritative embedding decision: OpenAI `text-embedding-3-small` with 1536 dimensions.
- Added plain SQL migrations for extensions, core tables, constraints, and indexes.
- Added UUID primary keys, foreign keys, timestamps, status checks, confidence/similarity checks, JSONB image attributes, and `vector(1536)` embedding columns.
- Kept migration execution dependency-free; no ORM or migration runner was added because ordered `psql` commands are sufficient at this stage.
- Did not add OpenAI integration, repositories, services, controllers, routes, Redis, BullMQ, matching logic, mismatch guard logic, or business logic.
