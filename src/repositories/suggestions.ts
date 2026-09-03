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

export class SuggestionRepository {
  public constructor(private readonly database: Pool = pool) {}

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
