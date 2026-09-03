import { Pool, type PoolConfig } from "pg";

const requiredEnvironmentVariables = [
  "POSTGRES_HOST",
  "POSTGRES_PORT",
  "POSTGRES_DB",
  "POSTGRES_USER",
  "POSTGRES_PASSWORD",
] as const;

type RequiredEnvironmentVariable = (typeof requiredEnvironmentVariables)[number];

function readDatabaseConfiguration(): PoolConfig {
  const missingVariables: RequiredEnvironmentVariable[] = [];
  const values = {} as Record<RequiredEnvironmentVariable, string>;

  for (const variable of requiredEnvironmentVariables) {
    const value = process.env[variable];
    if (!value?.trim()) {
      missingVariables.push(variable);
    } else {
      values[variable] = value;
    }
  }

  if (missingVariables.length > 0) {
    throw new Error(
      `Database configuration is incomplete. Missing environment variables: ${missingVariables.join(", ")}`,
    );
  }

  const port = Number(values.POSTGRES_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("Database configuration is invalid. POSTGRES_PORT must be an integer between 1 and 65535.");
  }

  return {
    host: values.POSTGRES_HOST,
    port,
    database: values.POSTGRES_DB,
    user: values.POSTGRES_USER,
    password: values.POSTGRES_PASSWORD,
  };
}

const databaseConfiguration = readDatabaseConfiguration();

// This module-level pool is cached by the ESM module loader, preventing accidental duplicate pools.
export const pool = new Pool(databaseConfiguration);

pool.on("error", () => {
  console.error("Unexpected idle PostgreSQL pool error.");
});

export async function checkDatabaseConnection(): Promise<void> {
  await pool.query("SELECT 1");
}

export async function closeDatabasePool(): Promise<void> {
  await pool.end();
}
