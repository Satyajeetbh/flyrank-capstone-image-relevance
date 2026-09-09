import { pool } from "../infrastructure/database.js";
import type { ProviderUsage } from "../domain/ai-usage.js";
import type { Pool } from "pg";

export type AiUsageEntityType = "image" | "post" | "suggestion" | "review" | "job";
export type AiUsageStatus = "pending" | "completed" | "failed";

export interface CreateAiUsageInput {
  entityType: AiUsageEntityType;
  entityId: string;
  operation: string;
  usage: ProviderUsage;
  estimatedCost?: number;
  status?: AiUsageStatus;
}

export interface AiUsageRecord {
  id: string;
  entityType: AiUsageEntityType;
  entityId: string;
  operation: string;
  provider: string;
  model: string;
  inputUnits: number;
  outputUnits: number;
  estimatedCost: number;
  status: AiUsageStatus;
  createdAt: Date;
}

type AiUsageRow = {
  id: string;
  entity_type: string;
  entity_id: string;
  operation: string;
  provider: string;
  model: string;
  input_units: number | string;
  output_units: number | string;
  estimated_cost: number | string;
  status: string;
  created_at: Date;
};

const entityTypes = new Set<AiUsageEntityType>(["image", "post", "suggestion", "review", "job"]);
const statuses = new Set<AiUsageStatus>(["pending", "completed", "failed"]);

function parseNonNegativeNumber(value: number | string, field: string): number {
  const numberValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numberValue) || numberValue < 0) {
    throw new Error(`Database returned an invalid ${field}.`);
  }

  return numberValue;
}

function mapAiUsageRow(row: AiUsageRow): AiUsageRecord {
  if (!entityTypes.has(row.entity_type as AiUsageEntityType)) {
    throw new Error("Database returned an invalid AI usage entity type.");
  }
  if (!statuses.has(row.status as AiUsageStatus)) {
    throw new Error("Database returned an invalid AI usage status.");
  }

  return {
    id: row.id,
    entityType: row.entity_type as AiUsageEntityType,
    entityId: row.entity_id,
    operation: row.operation,
    provider: row.provider,
    model: row.model,
    inputUnits: parseNonNegativeNumber(row.input_units, "AI usage input units"),
    outputUnits: parseNonNegativeNumber(row.output_units, "AI usage output units"),
    estimatedCost: parseNonNegativeNumber(row.estimated_cost, "AI usage estimated cost"),
    status: row.status as AiUsageStatus,
    createdAt: row.created_at,
  };
}

export class AiUsageRepository {
  public constructor(private readonly database: Pool = pool) {}

  public async create(input: CreateAiUsageInput): Promise<AiUsageRecord> {
    const result = await this.database.query<AiUsageRow>(
      `
        INSERT INTO ai_usage (
          entity_type, entity_id, operation, provider, model,
          input_units, output_units, estimated_cost, status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id, entity_type, entity_id, operation, provider, model,
          input_units, output_units, estimated_cost, status, created_at
      `,
      [
        input.entityType,        input.entityId,
        input.operation,
        input.usage.provider,
        input.usage.model,
        input.usage.inputUnits,
        input.usage.outputUnits,
        input.estimatedCost ?? 0,
        input.status ?? "completed",
      ],
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error("AI usage insert returned no row.");
    }

    return mapAiUsageRow(row);
  }

  public async findById(id: string): Promise<AiUsageRecord | null> {
    const result = await this.database.query<AiUsageRow>(
      `
        SELECT id, entity_type, entity_id, operation, provider, model,
          input_units, output_units, estimated_cost, status, created_at
        FROM ai_usage
        WHERE id = $1
      `,
      [id],
    );

    const row = result.rows[0];
    return row ? mapAiUsageRow(row) : null;
  }

  public async findByEntity(entityType: AiUsageEntityType, entityId: string): Promise<AiUsageRecord[]> {
    const result = await this.database.query<AiUsageRow>(
      `
        SELECT id, entity_type, entity_id, operation, provider, model,
          input_units, output_units, estimated_cost, status, created_at
        FROM ai_usage
        WHERE entity_type = $1 AND entity_id = $2
        ORDER BY created_at ASC, id ASC
      `,
      [entityType, entityId],
    );

    return result.rows.map(mapAiUsageRow);
  }
  public async getTotalEstimatedCost(): Promise<number> {
    const result = await this.database.query<{ total_cost: number | string | null }>(
      `
        SELECT COALESCE(SUM(estimated_cost), 0) AS total_cost
        FROM ai_usage
        WHERE status = 'completed'
      `,
    );

    const totalCost = result.rows[0]?.total_cost;

    if (totalCost === undefined || totalCost === null) {
      return 0;
    }

    return parseNonNegativeNumber(totalCost, "AI usage total estimated cost");
  }
}

export const aiUsageRepository = new AiUsageRepository();
