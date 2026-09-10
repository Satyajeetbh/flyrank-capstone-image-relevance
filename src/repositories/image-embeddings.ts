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

type SimilarImageRow = {
  image_id: string;
  similarity: number | string;
  subject: string;
  category: string;
  vision_confidence: number | string;
};

export interface SemanticImageCandidate {
  imageId: string;
  similarity: number;
  subject: string;
  category: string;
  visionConfidence: number;
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

function parseFiniteDatabaseNumber(value: number | string, field: string): number {
  const numberValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numberValue)) {
    throw new Error(`Database returned an invalid ${field}.`);
  }

  return numberValue;
}

function mapSimilarImageRow(row: SimilarImageRow): SemanticImageCandidate {
  return {
    imageId: row.image_id,
    similarity: parseFiniteDatabaseNumber(row.similarity, "similarity score"),
    subject: row.subject,
    category: row.category,
    visionConfidence: parseFiniteDatabaseNumber(row.vision_confidence, "vision confidence"),
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

  public async findSimilar(
    queryEmbedding: number[],
    embeddingModel: string,
    limit: number,
    storageReferencePrefix?: string,
  ): Promise<SemanticImageCandidate[]> {
    if (!Number.isInteger(limit) || limit < 1) {
      throw new Error("Similarity search limit must be a positive integer.");
    }

    const result = await this.database.query<SimilarImageRow>(
      `
        SELECT
          image_embeddings.image_id,
          1 - (image_embeddings.embedding <=> $1::vector) AS similarity,
          image_metadata.subject,
          image_metadata.category,
          image_metadata.vision_confidence
        FROM image_embeddings
        INNER JOIN images ON images.id = image_embeddings.image_id
        INNER JOIN image_metadata ON image_metadata.image_id = images.id
        WHERE image_embeddings.embedding_model = $2
          AND images.processing_status = 'completed'
          AND (
            $4::text IS NULL
            OR images.storage_reference LIKE $4::text || '%'
          )
        ORDER BY image_embeddings.embedding <=> $1::vector ASC
        LIMIT $3
      `,
      [
        serializeEmbeddingVector(queryEmbedding),
        embeddingModel,
        limit,
        storageReferencePrefix ?? null,
      ],
    );

    return result.rows.map(mapSimilarImageRow);
  }
}

export const imageEmbeddingRepository = new ImageEmbeddingRepository();
