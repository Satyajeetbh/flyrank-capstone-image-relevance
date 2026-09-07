import type { ImageMetadata } from "../domain/image-metadata.js";
import type { OpenAIVisionProvider } from "../providers/openai-vision.js";
import type { OpenAIEmbeddingProvider } from "../providers/openai-embeddings.js";
import {
  OPENAI_EMBEDDING_MODEL,
} from "../providers/openai-embeddings.js";
import { calculateEstimatedCost } from "./ai-cost.js";
import {
  imageMetadataRepository,
  type ImageMetadataRepository,
} from "../repositories/image-metadata.js";
import {
  imageEmbeddingRepository,
  type ImageEmbeddingRepository,
} from "../repositories/image-embeddings.js";
import {
  aiUsageRepository,
  type AiUsageRepository,
} from "../repositories/ai-usage.js";
import type { ImageRepository } from "../repositories/images.js";

export interface ProcessImageInput {
  imageId: string;
}

export interface ProcessImageResult {
  imageId: string;
  metadata: ImageMetadata;
  embeddingModel: string;
}

export class ImageProcessingService {
  public constructor(
    private readonly images: ImageRepository,
    private readonly visionProvider: OpenAIVisionProvider,
    private readonly embeddingProvider: OpenAIEmbeddingProvider,
    private readonly metadataRepository: ImageMetadataRepository = imageMetadataRepository,
    private readonly embeddingRepository: ImageEmbeddingRepository = imageEmbeddingRepository,
    private readonly usageRepository: AiUsageRepository = aiUsageRepository,
  ) {}

  public async processImage(
    input: ProcessImageInput,
  ): Promise<ProcessImageResult> {
    const image = await this.images.findById(input.imageId);

    if (!image) {
      throw new Error(`Image ${input.imageId} was not found.`);
    }

    const existingMetadata = await this.metadataRepository.findByImageId(
      input.imageId,
    );

    let metadata: ImageMetadata;

    if (existingMetadata) {
      metadata = {
        subject: existingMetadata.subject,
        category: existingMetadata.category,
        attributes: existingMetadata.attributes,
        caption: existingMetadata.caption,
        confidence: existingMetadata.confidence,
      };
    } else {
      const visionResult = await this.visionProvider.understandImage({
        imageUrl: image.sourceUrl,
      });

      metadata = visionResult.output;

      if (visionResult.usage) {
        await this.usageRepository.create({
          entityType: "image",
          entityId: input.imageId,
          operation: "vision_classification",
          usage: visionResult.usage,
          estimatedCost: calculateEstimatedCost(visionResult.usage) ?? 0,
        });
      }

      await this.metadataRepository.save(input.imageId, metadata);
    }

    const existingEmbedding = await this.embeddingRepository.findByImageId(
      input.imageId,
      OPENAI_EMBEDDING_MODEL,
    );

    if (!existingEmbedding) {
      const embeddingResult =
        await this.embeddingProvider.embedImageMetadata(metadata);

      await this.embeddingRepository.save(
        input.imageId,
        OPENAI_EMBEDDING_MODEL,
        embeddingResult.output,
      );

      if (embeddingResult.usage) {
        await this.usageRepository.create({
          entityType: "image",
          entityId: input.imageId,
          operation: "image_embedding",
          usage: embeddingResult.usage,
          estimatedCost: calculateEstimatedCost(embeddingResult.usage) ?? 0,
        });
      }
    }

    return {
      imageId: input.imageId,
      metadata,
      embeddingModel: OPENAI_EMBEDDING_MODEL,
    };
  }
}