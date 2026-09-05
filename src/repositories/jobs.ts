import { pool } from "../infrastructure/database.js";
import type { Pool } from "pg";

export type JobStatus = "queued" | "running" | "completed" | "failed";

export interface CreateJobInput {
  type: string;
}

export interface JobRecord {
  id: string;
  type: string;
  status: JobStatus;
  attempts: number;
  error: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
}

type JobRow = {
  id: string;
  type: string;
  status: string;
  attempts: number | string;
  error: string | null;
  started_at: Date | null;
  completed_at: Date | null;
  created_at: Date;
};

const jobStatuses = new Set<JobStatus>([
  "queued",
  "running",
  "completed",
  "failed",
]);

function parseNonNegativeInteger(value: number | string, field: string): number {
  const numberValue = typeof value === "number" ? value : Number(value);

  if (!Number.isInteger(numberValue) || numberValue < 0) {
    throw new Error(`Database returned an invalid ${field}.`);
  }

  return numberValue;
}

function mapJobRow(row: JobRow): JobRecord {
  if (!jobStatuses.has(row.status as JobStatus)) {
    throw new Error("Database returned an invalid job status.");
  }

  return {
    id: row.id,
    type: row.type,
    status: row.status as JobStatus,
    attempts: parseNonNegativeInteger(row.attempts, "job attempts"),
    error: row.error,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
  };
}

export class JobRepository {
  public constructor(private readonly database: Pool = pool) {}

  public async create(input: CreateJobInput): Promise<JobRecord> {
    const result = await this.database.query<JobRow>(
      `
        INSERT INTO jobs (type)
        VALUES ($1)
        RETURNING
          id,
          type,
          status,
          attempts,
          error,
          started_at,
          completed_at,
          created_at
      `,
      [input.type],
    );

    const row = result.rows[0];

    if (!row) {
      throw new Error("Job insert returned no row.");
    }

    return mapJobRow(row);
  }

  public async findById(id: string): Promise<JobRecord | null> {
    const result = await this.database.query<JobRow>(
      `
        SELECT
          id,
          type,
          status,
          attempts,
          error,
          started_at,
          completed_at,
          created_at
        FROM jobs
        WHERE id = $1
      `,
      [id],
    );

    const row = result.rows[0];

    return row ? mapJobRow(row) : null;
  }

  public async markRunning(id: string): Promise<JobRecord | null> {
    const result = await this.database.query<JobRow>(
      `
        UPDATE jobs
        SET
          status = 'running',
          attempts = attempts + 1,
          started_at = COALESCE(started_at, NOW()),
          error = NULL
        WHERE id = $1
        RETURNING
          id,
          type,
          status,
          attempts,
          error,
          started_at,
          completed_at,
          created_at
      `,
      [id],
    );

    const row = result.rows[0];

    return row ? mapJobRow(row) : null;
  }

  public async markCompleted(id: string): Promise<JobRecord | null> {
    const result = await this.database.query<JobRow>(
      `
        UPDATE jobs
        SET
          status = 'completed',
          completed_at = NOW(),
          error = NULL
        WHERE id = $1
        RETURNING
          id,
          type,
          status,
          attempts,
          error,
          started_at,
          completed_at,
          created_at
      `,
      [id],
    );

    const row = result.rows[0];

    return row ? mapJobRow(row) : null;
  }

  public async markFailed(
    id: string,
    error: string,
  ): Promise<JobRecord | null> {
    const result = await this.database.query<JobRow>(
      `
        UPDATE jobs
        SET
          status = 'failed',
          error = $2,
          completed_at = NOW()
        WHERE id = $1
        RETURNING
          id,
          type,
          status,
          attempts,
          error,
          started_at,
          completed_at,
          created_at
      `,
      [id, error],
    );

    const row = result.rows[0];

    return row ? mapJobRow(row) : null;
  }
}

export const jobRepository = new JobRepository();