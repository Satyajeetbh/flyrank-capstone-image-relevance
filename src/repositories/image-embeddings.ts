import { pool } from "../infrastructure/database.js";
import type { Pool } from "pg";

import { parseEmbeddingVector, serializeEmbeddingVector } from "./embedding-vector.js";

export interface ImageEmbeddingRecord {
  id: string;
  imageId: string;
  embeddingModel: string;
  embedding: number[];
  createdAt: Date;
}

type ImageEmbeddingRow = {
  id: string;
  image_id: string;
  embedding_model: string;
  embedding: string;
  created_at: Date;
};

function mapImageEmbeddingRow(row: ImageEmbeddingRow): ImageEmbeddingRecord {
  return {
    id: row.id,
    imageId: row.image_id,
    embeddingModel: row.embedding_model,
    embedding: parseEmbeddingVector(row.embedding),
    createdAt: row.created_at,
  };
}

export class ImageEmbeddingRepository {
  public constructor(private readonly database: Pool = pool) {}

  /**
   * Duplicate image/model pairs are rejected by the existing database unique constraint.
   * This repository intentionally does not define an upsert policy.
   */
  public async save(
    imageId: string,
    embeddingModel: string,
    embedding: number[],
  ): Promise<ImageEmbeddingRecord> {
    const result = await this.database.query<ImageEmbeddingRow>(
      `
        INSERT INTO image_embeddings (image_id, embedding_model, embedding)
        VALUES ($1, $2, $3::vector)
        RETURNING id, image_id, embedding_model, embedding::text AS embedding, created_at
      `,
      [imageId, embeddingModel, serializeEmbeddingVector(embedding)],
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error("Image embedding insert returned no row.");
    }

    return mapImageEmbeddingRow(row);
  }

  public async findByImageId(
    imageId: string,
    embeddingModel: string,
  ): Promise<ImageEmbeddingRecord | null> {
    const result = await this.database.query<ImageEmbeddingRow>(
      `
        SELECT id, image_id, embedding_model, embedding::text AS embedding, created_at
        FROM image_embeddings
        WHERE image_id = $1 AND embedding_model = $2
      `,
      [imageId, embeddingModel],
    );

    const row = result.rows[0];
    return row ? mapImageEmbeddingRow(row) : null;
  }
}

export const imageEmbeddingRepository = new ImageEmbeddingRepository();
