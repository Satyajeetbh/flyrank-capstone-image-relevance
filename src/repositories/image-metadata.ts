import { pool } from "../infrastructure/database.js";
import type { ImageMetadata } from "../domain/image-metadata.js";
import type { Pool } from "pg";

export interface ImageMetadataRecord extends ImageMetadata {
  id: string;
  imageId: string;
  createdAt: Date;
  updatedAt: Date;
}

type ImageMetadataRow = {
  id: string;
  image_id: string;
  subject: string;
  category: string;
  attributes: unknown;
  caption: string;
  vision_confidence: number | string;
  created_at: Date;
  updated_at: Date;
};

function parseAttributes(value: unknown): string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    throw new Error("Database returned invalid image metadata attributes.");
  }

  return value;
}

function parseConfidence(value: number | string): number {
  const confidence = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    throw new Error("Database returned invalid image metadata confidence.");
  }

  return confidence;
}

function mapImageMetadataRow(row: ImageMetadataRow): ImageMetadataRecord {
  return {
    id: row.id,
    imageId: row.image_id,
    subject: row.subject,
    category: row.category,
    attributes: parseAttributes(row.attributes),
    caption: row.caption,
    confidence: parseConfidence(row.vision_confidence),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class ImageMetadataRepository {
  public constructor(private readonly database: Pool = pool) {}

  public async save(
    imageId: string,
    metadata: ImageMetadata,
  ): Promise<ImageMetadataRecord> {
    const result = await this.database.query<ImageMetadataRow>(
      `
        INSERT INTO image_metadata (
          image_id,
          subject,
          category,
          attributes,
          caption,
          vision_confidence
        )
        VALUES ($1, $2, $3, $4::jsonb, $5, $6)
        RETURNING
          id,
          image_id,
          subject,
          category,
          attributes,
          caption,
          vision_confidence,
          created_at,
          updated_at
      `,
      [
        imageId,
        metadata.subject,
        metadata.category,
        JSON.stringify(metadata.attributes),
        metadata.caption,
        metadata.confidence,
      ],
    );

    const row = result.rows[0];

    if (!row) {
      throw new Error("Image metadata insert returned no row.");
    }

    return mapImageMetadataRow(row);
  }

  public async findByImageId(
    imageId: string,
  ): Promise<ImageMetadataRecord | null> {
    const result = await this.database.query<ImageMetadataRow>(
      `
        SELECT
          id,
          image_id,
          subject,
          category,
          attributes,
          caption,
          vision_confidence,
          created_at,
          updated_at
        FROM image_metadata
        WHERE image_id = $1
      `,
      [imageId],
    );

    const row = result.rows[0];

    return row ? mapImageMetadataRow(row) : null;
  }
}

export const imageMetadataRepository = new ImageMetadataRepository();