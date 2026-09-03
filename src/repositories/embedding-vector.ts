export const EMBEDDING_VECTOR_DIMENSIONS = 1536;

export function validateEmbeddingVector(value: unknown): number[] {
  if (!Array.isArray(value) || value.length !== EMBEDDING_VECTOR_DIMENSIONS) {
    throw new Error(`Embedding vector must contain exactly ${EMBEDDING_VECTOR_DIMENSIONS} values.`);
  }

  if (!value.every((component) => typeof component === "number" && Number.isFinite(component))) {
    throw new Error("Embedding vector must contain only finite numbers.");
  }

  return value;
}

export function serializeEmbeddingVector(value: unknown): string {
  return `[${validateEmbeddingVector(value).join(",")}]`;
}

export function parseEmbeddingVector(value: string): number[] {
  try {
    return validateEmbeddingVector(JSON.parse(value) as unknown);
  } catch {
    throw new Error("Database returned an invalid embedding vector.");
  }
}
