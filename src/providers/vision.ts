import type { ImageMetadata } from "../domain/image-metadata.js";
import type { ProviderResult } from "../domain/ai-usage.js";

export interface VisionInput {
  imageId: string;
  imageUrl: string;
}

export interface VisionProvider {
  understandImage(
    input: VisionInput,
  ): Promise<ProviderResult<ImageMetadata>>;
}