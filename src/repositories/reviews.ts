import { pool } from "../infrastructure/database.js";
import type { Pool } from "pg";

export type ReviewDecision = "approved" | "rejected" | "needs_review";

export interface CreateReviewInput {
  suggestionId: string;
  decision: ReviewDecision;
  reviewer: string;
  reason: string | null;
}

export interface ReviewRecord {
  id: string;
  suggestionId: string;
  decision: ReviewDecision;
  reason: string | null;
  reviewer: string;
  createdAt: Date;
}

type ReviewRow = {
  id: string;
  suggestion_id: string;
  decision: string;
  reason: string | null;
  reviewer: string;
  created_at: Date;
};

const reviewDecisions = new Set<ReviewDecision>(["approved", "rejected", "needs_review"]);

function mapReviewRow(row: ReviewRow): ReviewRecord {
  if (!reviewDecisions.has(row.decision as ReviewDecision)) {
    throw new Error("Database returned an invalid review decision.");
  }

  return {
    id: row.id,
    suggestionId: row.suggestion_id,
    decision: row.decision as ReviewDecision,
    reason: row.reason,
    reviewer: row.reviewer,
    createdAt: row.created_at,
  };
}

export class ReviewRepository {
  public constructor(private readonly database: Pool = pool) {}

  public async create(input: CreateReviewInput): Promise<ReviewRecord> {
    const result = await this.database.query<ReviewRow>(
      `
        INSERT INTO reviews (suggestion_id, decision, reason, reviewer)
        VALUES ($1, $2, $3, $4)
        RETURNING id, suggestion_id, decision, reason, reviewer, created_at
      `,
      [input.suggestionId, input.decision, input.reason, input.reviewer],
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error("Review insert returned no row.");
    }

    return mapReviewRow(row);
  }

  public async findBySuggestionId(suggestionId: string): Promise<ReviewRecord[]> {
    const result = await this.database.query<ReviewRow>(
      `
        SELECT id, suggestion_id, decision, reason, reviewer, created_at
        FROM reviews
        WHERE suggestion_id = $1
        ORDER BY created_at ASC, id ASC
      `,
      [suggestionId],
    );

    return result.rows.map(mapReviewRow);
  }
}

export const reviewRepository = new ReviewRepository();
