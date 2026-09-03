import { pool } from "../infrastructure/database.js";
import type { Pool } from "pg";

export type ImageProcessingStatus = "pending" | "processing" | "completed" | "failed";

export interface CreateImageInput {
  sourceUrl: string;
  storageReference?: string | null;
  processingStatus?: ImageProcessingStatus;
}

export interface ImageRecord {
  id: string;
  sourceUrl: string;
  storageReference: string | null;
  processingStatus: ImageProcessingStatus;
  createdAt: Date;
  updatedAt: Date;
}

type ImageRow = {
  id: string;
  source_url: string;
  storage_reference: string | null;
  processing_status: string;
  created_at: Date;
  updated_at: Date;
};

const imageProcessingStatuses = new Set<ImageProcessingStatus>([
  "pending",
  "processing",
  "completed",
  "failed",
]);

function mapImageRow(row: ImageRow): ImageRecord {
  if (!imageProcessingStatuses.has(row.processing_status as ImageProcessingStatus)) {
    throw new Error("Database returned an invalid image processing status.");
  }

  return {
    id: row.id,
    sourceUrl: row.source_url,
    storageReference: row.storage_reference,
    processingStatus: row.processing_status as ImageProcessingStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class ImageRepository {
  public constructor(private readonly database: Pool = pool) {}

  public async create(input: CreateImageInput): Promise<ImageRecord> {
    const result = await this.database.query<ImageRow>(
      `
        INSERT INTO images (source_url, storage_reference, processing_status)
        VALUES ($1, $2, COALESCE($3, 'pending'))
        RETURNING id, source_url, storage_reference, processing_status, created_at, updated_at
      `,
      [input.sourceUrl, input.storageReference ?? null, input.processingStatus ?? null],
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error("Image insert returned no row.");
    }

    return mapImageRow(row);
  }

  public async findById(id: string): Promise<ImageRecord | null> {
    const result = await this.database.query<ImageRow>(
      `
        SELECT id, source_url, storage_reference, processing_status, created_at, updated_at
        FROM images
        WHERE id = $1
      `,
      [id],
    );

    const row = result.rows[0];
    return row ? mapImageRow(row) : null;
  }

  public async list(): Promise<ImageRecord[]> {
    const result = await this.database.query<ImageRow>(
      `
        SELECT id, source_url, storage_reference, processing_status, created_at, updated_at
        FROM images
        ORDER BY created_at ASC, id ASC
      `,
    );

    return result.rows.map(mapImageRow);
  }

  public async updateProcessingStatus(
    id: string,
    processingStatus: ImageProcessingStatus,
  ): Promise<ImageRecord | null> {
    const result = await this.database.query<ImageRow>(
      `
        UPDATE images
        SET processing_status = $2, updated_at = NOW()
        WHERE id = $1
        RETURNING id, source_url, storage_reference, processing_status, created_at, updated_at
      `,
      [id, processingStatus],
    );

    const row = result.rows[0];
    return row ? mapImageRow(row) : null;
  }
}

export const imageRepository = new ImageRepository();
