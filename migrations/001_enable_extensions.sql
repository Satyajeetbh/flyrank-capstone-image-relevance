-- Stage 2 persistence foundation.
-- pgcrypto supplies UUID defaults; vector supplies pgvector columns.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;
