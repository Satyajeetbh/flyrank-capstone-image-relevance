import type { ImageMetadata } from "../domain/image-metadata.js";
import type { VisionProvider } from "../providers/vision.js";
import type { EmbeddingProvider } from "../providers/embedding.js";
import { getEmbeddingModel } from "../providers/embedding-config.js";
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
import {
  assertWithinAiBudget,
  DEFAULT_AI_USAGE_BUDGET_USD,
} from "../domain/ai-budget.js";

function readAiUsageBudget(): number {
  const value = process.env.AI_USAGE_BUDGET_USD;

  if (!value?.trim()) {
    return DEFAULT_AI_USAGE_BUDGET_USD;
  }

  const budget = Number(value);

  if (!Number.isFinite(budget) || budget <= 0) {
    throw new Error(
      "AI_USAGE_BUDGET_USD must be a positive finite number.",
    );
  }

  return budget;
}

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
    private readonly visionProvider: VisionProvider,
    private readonly embeddingProvider: EmbeddingProvider,
    private readonly metadataRepository: ImageMetadataRepository = imageMetadataRepository,
    private readonly embeddingRepository: ImageEmbeddingRepository = imageEmbeddingRepository,
    private readonly usageRepository: AiUsageRepository = aiUsageRepository,
    private readonly usageBudgetUsd: number = readAiUsageBudget(),
  ) {}

  public async processImage(
    input: ProcessImageInput,
  ): Promise<ProcessImageResult> {
    const image = await this.images.findById(input.imageId);

    if (!image) {
      throw new Error(`Image ${input.imageId} was not found.`);
    }
    const embeddingModel = getEmbeddingModel();

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
      const currentEstimatedCost =
        await this.usageRepository.getTotalEstimatedCost();

      assertWithinAiBudget(
        currentEstimatedCost,
        this.usageBudgetUsd,
      );
      const visionResult = await this.visionProvider.understandImage({
        imageId: input.imageId,
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
      embeddingModel,
    );

    if (!existingEmbedding) {
      const currentEstimatedCost =
        await this.usageRepository.getTotalEstimatedCost();

      assertWithinAiBudget(
        currentEstimatedCost,
        this.usageBudgetUsd,
      );
      const embeddingResult =
        await this.embeddingProvider.embedImageMetadata(metadata);

      await this.embeddingRepository.save(
        input.imageId,
        embeddingModel,
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
      embeddingModel,
    };
  }
}