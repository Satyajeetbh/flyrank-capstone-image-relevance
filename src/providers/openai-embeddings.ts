import OpenAI from "openai";
import { z } from "zod";

import type { ImageMetadata } from "../domain/image-metadata.js";

export const OPENAI_EMBEDDING_MODEL = "text-embedding-3-small" as const;
export const OPENAI_EMBEDDING_DIMENSIONS = 1536 as const;

export interface PostEmbeddingInput {
  title: string;
  content: string;
}

export function imageMetadataToEmbeddingText(metadata: ImageMetadata): string {
  return [
    `Subject: ${metadata.subject}`,
    `Category: ${metadata.category}`,
    `Attributes: ${metadata.attributes.join(", ")}`,
    `Caption: ${metadata.caption}`,
  ].join("\n");
}

export function postToEmbeddingText(input: PostEmbeddingInput): string {
  return [`Title: ${input.title}`, `Content: ${input.content}`].join("\n");
}

export type OpenAIEmbeddingErrorKind = "provider_api_failure" | "invalid_embedding_output";

export class OpenAIEmbeddingError extends Error {
  public constructor(
    message: string,
    public readonly kind: OpenAIEmbeddingErrorKind,
  ) {
    super(message);
    this.name = "OpenAIEmbeddingError";
  }
}

const embeddingResponseSchema = z.object({
  data: z.array(z.object({ embedding: z.unknown() })).min(1),
});

const embeddingVectorSchema = z.array(z.number().finite()).length(OPENAI_EMBEDDING_DIMENSIONS);

export function parseEmbeddingResponse(rawResponse: unknown): number[] {
  const response = embeddingResponseSchema.safeParse(rawResponse);
  const rawEmbedding = response.success ? response.data.data[0]?.embedding : undefined;
  const embedding = embeddingVectorSchema.safeParse(rawEmbedding);

  if (!embedding.success) {
    throw new OpenAIEmbeddingError(
      "OpenAI embedding output failed vector validation.",
      "invalid_embedding_output",
    );
  }

  return embedding.data;
}

export class OpenAIEmbeddingProvider {
  private readonly client: OpenAI;

  public constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey?.trim()) {
      throw new OpenAIEmbeddingError("OPENAI_API_KEY is not configured.", "provider_api_failure");
    }

    this.client = new OpenAI({ apiKey });
  }

  public async embedImageMetadata(metadata: ImageMetadata): Promise<number[]> {
    return this.embedText(imageMetadataToEmbeddingText(metadata));
  }

  public async embedPost(input: PostEmbeddingInput): Promise<number[]> {
    return this.embedText(postToEmbeddingText(input));
  }

  private async embedText(text: string): Promise<number[]> {
    let response: OpenAI.Embeddings.CreateEmbeddingResponse;

    try {
      response = await this.client.embeddings.create({
        model: OPENAI_EMBEDDING_MODEL,
        input: text,
      });
    } catch {
      throw new OpenAIEmbeddingError("OpenAI embedding request failed.", "provider_api_failure");
    }

    return parseEmbeddingResponse(response);
  }
}
