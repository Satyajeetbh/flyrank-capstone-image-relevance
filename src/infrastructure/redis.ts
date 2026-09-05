import { Redis } from "ioredis";

const requiredEnvironmentVariables = [
  "REDIS_HOST",
  "REDIS_PORT",
] as const;

type RequiredEnvironmentVariable =
  (typeof requiredEnvironmentVariables)[number];

function readRedisConfiguration() {
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
      `Redis configuration is incomplete. Missing environment variables: ${missingVariables.join(", ")}`,
    );
  }

  const port = Number(values.REDIS_PORT);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(
      "Redis configuration is invalid. REDIS_PORT must be an integer between 1 and 65535.",
    );
  }

  return {
    host: values.REDIS_HOST,
    port,
  };
}

const redisConfiguration = readRedisConfiguration();

export const redisConnection = new Redis({
  host: redisConfiguration.host,
  port: redisConfiguration.port,
  maxRetriesPerRequest: null,
});

redisConnection.on("error", () => {
  console.error("Unexpected Redis connection error.");
});

export async function checkRedisConnection(): Promise<void> {
  await redisConnection.ping();
}

export async function closeRedisConnection(): Promise<void> {
  await redisConnection.quit();
}