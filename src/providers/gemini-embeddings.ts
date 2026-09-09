import { GoogleGenAI } from "@google/genai";

import type { ImageMetadata } from "../domain/image-metadata.js";
import type { ProviderResult, ProviderUsage } from "../domain/ai-usage.js";
import {
  imageMetadataToEmbeddingText,
  postToEmbeddingText,
  type EmbeddingProvider,
  type PostEmbeddingInput,
} from "./embedding.js";

export const GEMINI_EMBEDDING_MODEL = "gemini-embedding-2" as const;
export const GEMINI_EMBEDDING_DIMENSIONS = 1536 as const;

export type GeminiEmbeddingErrorKind =
  | "provider_api_failure"
  | "invalid_embedding_output";

export class GeminiEmbeddingError extends Error {
  public constructor(
    message: string,
    public readonly kind: GeminiEmbeddingErrorKind,
  ) {
    super(message);
    this.name = "GeminiEmbeddingError";
  }
}

export function parseEmbeddingVector(rawEmbedding: unknown): number[] {
  if (!Array.isArray(rawEmbedding)) {
    throw new GeminiEmbeddingError(
      "Gemini embedding output did not contain a vector.",
      "invalid_embedding_output",
    );
  }

  if (
    rawEmbedding.length !== GEMINI_EMBEDDING_DIMENSIONS ||
    rawEmbedding.some(
      (value) => typeof value !== "number" || !Number.isFinite(value),
    )
  ) {
    throw new GeminiEmbeddingError(
      "Gemini embedding output failed vector validation.",
      "invalid_embedding_output",
    );
  }

  return rawEmbedding;
}

export class GeminiEmbeddingProvider implements EmbeddingProvider {
  private readonly client: GoogleGenAI;

  public constructor() {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey?.trim()) {
      throw new GeminiEmbeddingError(
        "GEMINI_API_KEY is not configured.",
        "provider_api_failure",
      );
    }

    this.client = new GoogleGenAI({
      apiKey,
    });
  }

  public async embedImageMetadata(
    metadata: ImageMetadata,
  ): Promise<ProviderResult<number[]>> {
    return this.embedText(imageMetadataToEmbeddingText(metadata));
  }

  public async embedPost(
    input: PostEmbeddingInput,
  ): Promise<ProviderResult<number[]>> {
    return this.embedText(postToEmbeddingText(input));
  }

  private async embedText(
    text: string,
  ): Promise<ProviderResult<number[]>> {
    let response;

    try {
      response = await this.client.models.embedContent({
        model: GEMINI_EMBEDDING_MODEL,
        contents: text,
        config: {
          outputDimensionality: GEMINI_EMBEDDING_DIMENSIONS,
        },
      });
    } catch {
      throw new GeminiEmbeddingError(
        "Gemini embedding request failed.",
        "provider_api_failure",
      );
    }

    const embedding = parseEmbeddingVector(
      response.embeddings?.[0]?.values,
    );

    return {
      output: embedding,
        // The installed @google/genai SDK does not expose embedding token usage.
        // Zero units mean usage metrics are unavailable, not that zero tokens were used.
        // Gemini Embedding 2 is configured as zero estimated monetary cost here.
        usage: {
          provider: "gemini",
          model: GEMINI_EMBEDDING_MODEL,
          inputUnits: 0,
          outputUnits: 0,
        },
    };
  }
}