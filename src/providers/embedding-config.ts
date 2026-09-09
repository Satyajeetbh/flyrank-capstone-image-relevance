import {
  GEMINI_EMBEDDING_MODEL,
} from "./gemini-embeddings.js";
import {
  OPENAI_EMBEDDING_MODEL,
} from "./openai-embeddings.js";

export function getEmbeddingModel(): string {
  const provider = process.env.EMBEDDING_PROVIDER?.trim().toLowerCase();

  if (provider === "gemini") {
    return GEMINI_EMBEDDING_MODEL;
  }

  if (provider === "openai" || !provider) {
    return OPENAI_EMBEDDING_MODEL;
  }

  throw new Error(
    `Unsupported EMBEDDING_PROVIDER "${provider}". Expected "gemini" or "openai".`,
  );
}