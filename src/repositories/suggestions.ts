import { pool } from "../infrastructure/database.js";
import type { Pool } from "pg";

export type SuggestionGuardStatus = "accept" | "reject" | "review";

export interface CreateSuggestionInput {
  postId: string;
  imageId: string;
  similarityScore: number;
  guardStatus: SuggestionGuardStatus;
  reason: string;
}

export interface SuggestionRecord {
  id: string;
  postId: string;
  imageId: string;
  similarityScore: number;
  guardStatus: SuggestionGuardStatus;
  reason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SuggestionContextRecord {
  id: string;
  post: {
    id: string;
    title: string;
    content: string;
    expectedSubject: string;
    expectedCategory: string;
  };
  image: {
    id: string;
    sourceUrl: string;
    metadata: {
      subject: string;
      category: string;
      attributes: string[];
      caption: string;
      visionConfidence: number;
    };
  };
  similarityScore: number;
  guardStatus: SuggestionGuardStatus;
  reason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

type SuggestionRow = {
  id: string;
  post_id: string;
  image_id: string;
  similarity_score: number | string;
  guard_status: string;
  reason: string | null;
  created_at: Date;
  updated_at: Date;
};

type SuggestionContextRow = {
  id: string;
  post_id: string;
  image_id: string;
  similarity_score: number | string;
  guard_status: string;
  reason: string | null;
  created_at: Date;
  updated_at: Date;
  post_title: string;
  post_content: string;
  expected_subject: string;
  expected_category: string;
  source_url: string;
  metadata_subject: string;
  metadata_category: string;
  attributes: unknown;
  caption: string;
  vision_confidence: number | string;
};

const suggestionGuardStatuses = new Set<SuggestionGuardStatus>([
  "accept",
  "reject",
  "review",
]);

function parseSimilarityScore(value: number | string): number {
  const score = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(score)) {
    throw new Error("Database returned an invalid suggestion similarity score.");
  }

  return score;
}

function parseVisionConfidence(value: number | string): number {
  const confidence = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(confidence)) {
    throw new Error("Database returned an invalid vision confidence.");
  }

  return confidence;
}

function mapSuggestionRow(row: SuggestionRow): SuggestionRecord {
  if (!suggestionGuardStatuses.has(row.guard_status as SuggestionGuardStatus)) {
    throw new Error("Database returned an invalid suggestion guard status.");
  }

  return {
    id: row.id,
    postId: row.post_id,
    imageId: row.image_id,
    similarityScore: parseSimilarityScore(row.similarity_score),
    guardStatus: row.guard_status as SuggestionGuardStatus,
    reason: row.reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSuggestionContextRow(row: SuggestionContextRow): SuggestionContextRecord {
  if (!suggestionGuardStatuses.has(row.guard_status as SuggestionGuardStatus)) {
    throw new Error("Database returned an invalid suggestion guard status.");
  }
  if (!Array.isArray(row.attributes) || !row.attributes.every((attribute) => typeof attribute === "string")) {
    throw new Error("Database returned invalid image attributes.");
  }

  return {
    id: row.id,
    post: {
      id: row.post_id,
      title: row.post_title,
      content: row.post_content,
      expectedSubject: row.expected_subject,
      expectedCategory: row.expected_category,
    },
    image: {
      id: row.image_id,
      sourceUrl: row.source_url,
      metadata: {
        subject: row.metadata_subject,
        category: row.metadata_category,
        attributes: row.attributes,
        caption: row.caption,
        visionConfidence: parseVisionConfidence(row.vision_confidence),
      },
    },
    similarityScore: parseSimilarityScore(row.similarity_score),
    guardStatus: row.guard_status as SuggestionGuardStatus,
    reason: row.reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SuggestionRepository {
  public constructor(private readonly database: Pool = pool) {}

  public async findByIdWithContext(id: string): Promise<SuggestionContextRecord | null> {
    const result = await this.database.query<SuggestionContextRow>(
      `
        SELECT
          suggestions.id,
          suggestions.post_id,
          suggestions.image_id,
          suggestions.similarity_score,
          suggestions.guard_status,
          suggestions.reason,
          suggestions.created_at,
          suggestions.updated_at,
          posts.title AS post_title,
          posts.content AS post_content,
          posts.expected_subject,
          posts.expected_category,
          images.source_url,
          image_metadata.subject AS metadata_subject,
          image_metadata.category AS metadata_category,
          image_metadata.attributes,
          image_metadata.caption,
          image_metadata.vision_confidence
        FROM suggestions
        INNER JOIN posts ON posts.id = suggestions.post_id
        INNER JOIN images ON images.id = suggestions.image_id
        INNER JOIN image_metadata ON image_metadata.image_id = images.id
        WHERE suggestions.id = $1
      `,
      [id],
    );

    const row = result.rows[0];
    return row ? mapSuggestionContextRow(row) : null;
  }

  public async create(input: CreateSuggestionInput): Promise<SuggestionRecord> {
    const result = await this.database.query<SuggestionRow>(
      `
        INSERT INTO suggestions (post_id, image_id, similarity_score, guard_status, reason)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, post_id, image_id, similarity_score, guard_status, reason, created_at, updated_at
      `,
      [input.postId, input.imageId, input.similarityScore, input.guardStatus, input.reason],
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error("Suggestion insert returned no row.");
    }

    return mapSuggestionRow(row);
  }
}

export const suggestionRepository = new SuggestionRepository();
