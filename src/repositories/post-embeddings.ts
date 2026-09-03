import { pool } from "../infrastructure/database.js";
import type { Pool } from "pg";

import { parseEmbeddingVector, serializeEmbeddingVector } from "./embedding-vector.js";

export interface PostEmbeddingRecord {
  id: string;
  postId: string;
  embeddingModel: string;
  embedding: number[];
  createdAt: Date;
}

type PostEmbeddingRow = {
  id: string;
  post_id: string;
  embedding_model: string;
  embedding: string;
  created_at: Date;
};

function mapPostEmbeddingRow(row: PostEmbeddingRow): PostEmbeddingRecord {
  return {
    id: row.id,
    postId: row.post_id,
    embeddingModel: row.embedding_model,
    embedding: parseEmbeddingVector(row.embedding),
    createdAt: row.created_at,
  };
}

export class PostEmbeddingRepository {
  public constructor(private readonly database: Pool = pool) {}

  /**
   * Duplicate post/model pairs are rejected by the existing database unique constraint.
   * This repository intentionally does not define an upsert policy.
   */
  public async save(
    postId: string,
    embeddingModel: string,
    embedding: number[],
  ): Promise<PostEmbeddingRecord> {
    const result = await this.database.query<PostEmbeddingRow>(
      `
        INSERT INTO post_embeddings (post_id, embedding_model, embedding)
        VALUES ($1, $2, $3::vector)
        RETURNING id, post_id, embedding_model, embedding::text AS embedding, created_at
      `,
      [postId, embeddingModel, serializeEmbeddingVector(embedding)],
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error("Post embedding insert returned no row.");
    }

    return mapPostEmbeddingRow(row);
  }

  public async findByPostId(postId: string, embeddingModel: string): Promise<PostEmbeddingRecord | null> {
    const result = await this.database.query<PostEmbeddingRow>(
      `
        SELECT id, post_id, embedding_model, embedding::text AS embedding, created_at
        FROM post_embeddings
        WHERE post_id = $1 AND embedding_model = $2
      `,
      [postId, embeddingModel],
    );

    const row = result.rows[0];
    return row ? mapPostEmbeddingRow(row) : null;
  }
}

export const postEmbeddingRepository = new PostEmbeddingRepository();
