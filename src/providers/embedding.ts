import type { ImageMetadata } from "../domain/image-metadata.js";
import type { ProviderResult } from "../domain/ai-usage.js";

export interface PostEmbeddingInput {
  title: string;
  content: string;
}

export interface EmbeddingProvider {
  embedImageMetadata(
    metadata: ImageMetadata,
  ): Promise<ProviderResult<number[]>>;

  embedPost(
    input: PostEmbeddingInput,
  ): Promise<ProviderResult<number[]>>;
}

export function imageMetadataToEmbeddingText(
  metadata: ImageMetadata,
): string {
  return [
    `Subject: ${metadata.subject}`,
    `Category: ${metadata.category}`,
    `Attributes: ${metadata.attributes.join(", ")}`,
    `Caption: ${metadata.caption}`,
  ].join("\n");
}

export function postToEmbeddingText(
  input: PostEmbeddingInput,
): string {
  return [`Title: ${input.title}`, `Content: ${input.content}`].join("\n");
}