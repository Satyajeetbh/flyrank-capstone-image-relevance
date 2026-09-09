import { Worker, UnrecoverableError, type Job } from "bullmq";

import {
  IMAGE_PROCESSING_QUEUE_NAME,
  type ImageProcessingJobData,
} from "../infrastructure/image-processing-queue.js";
import { redisConnection } from "../infrastructure/redis.js";
import { ImageProcessingJobError } from "../domain/job-errors.js";
import { ImageProcessingService } from "../application/image-processing.js";
import { imageRepository } from "../repositories/images.js";
import {
  jobRepository,
  type JobRepository,
} from "../repositories/jobs.js";
import { OpenAIVisionError, OpenAIVisionProvider } from "../providers/openai-vision.js";
import { LocalVisionProvider } from "../providers/local-vision.js";
import type { VisionProvider } from "../providers/vision.js";
import { OpenAIEmbeddingProvider } from "../providers/openai-embeddings.js";
import { GeminiEmbeddingProvider } from "../providers/gemini-embeddings.js";
import type { EmbeddingProvider } from "../providers/embedding.js";

function isFinalAttempt(job: Job<ImageProcessingJobData>): boolean {
  const maximumAttempts = job.opts.attempts ?? 1;

  return job.attemptsMade + 1 >= maximumAttempts;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Image processing failed.";
}

function getErrorKind(error: unknown): "retryable" | "permanent" {
  if (error instanceof ImageProcessingJobError) {
    return error.kind;
  }

  if (
    error instanceof OpenAIVisionError &&
    error.kind === "invalid_model_output"
  ) {
    return "permanent";
  }

  return "retryable";
}

function getAttemptInfo(job: Job<ImageProcessingJobData>): {
  attempt: number;
  maximumAttempts: number;
} {
  return {
    attempt: job.attemptsMade + 1,
    maximumAttempts: job.opts.attempts ?? 1,
  };
}

function createVisionProvider(): VisionProvider {
  const provider = process.env.VISION_PROVIDER?.trim().toLowerCase();

  if (provider === "local") {
    return new LocalVisionProvider();
  }

  if (provider === "openai" || !provider) {
    return new OpenAIVisionProvider();
  }

  throw new Error(
    `Unsupported VISION_PROVIDER "${provider}". Expected "local" or "openai".`,
  );
}

function createEmbeddingProvider(): EmbeddingProvider {
  const provider = process.env.EMBEDDING_PROVIDER?.trim().toLowerCase();

  if (provider === "gemini") {
    return new GeminiEmbeddingProvider();
  }

  if (provider === "openai" || !provider) {
    return new OpenAIEmbeddingProvider();
  }

  throw new Error(
    `Unsupported EMBEDDING_PROVIDER "${provider}". Expected "gemini" or "openai".`,
  );
}

export function createImageProcessingService(): ImageProcessingService {
  return new ImageProcessingService(
    imageRepository,
    createVisionProvider(),
    createEmbeddingProvider(),
  );
}

export async function processImageProcessingJob(
  job: Job<ImageProcessingJobData>,
  repository: JobRepository,
  processingService: ImageProcessingService,
): Promise<void> {
  const { jobId, imageId } = job.data;
  const startedAt = Date.now();
  const { attempt, maximumAttempts } = getAttemptInfo(job);

  console.info(
    `[image-processing] started jobId=${jobId} imageId=${imageId} attempt=${attempt}/${maximumAttempts}`,
  );

  try {
    const databaseJob = await repository.findById(jobId);

    if (!databaseJob) {
      throw new ImageProcessingJobError(
        `Database job ${jobId} was not found.`,
        "permanent",
      );
    }

    const runningJob = await repository.markRunning(jobId);

    if (!runningJob) {
      throw new ImageProcessingJobError(
        `Database job ${jobId} could not be marked running.`,
        "permanent",
      );
    }

    await imageRepository.updateProcessingStatus(imageId, "processing");

    await processingService.processImage({ imageId });

    await imageRepository.updateProcessingStatus(imageId, "completed");

    await repository.markCompleted(jobId);

    console.info(
      `[image-processing] completed jobId=${jobId} imageId=${imageId} attempt=${attempt}/${maximumAttempts} durationMs=${Date.now() - startedAt}`,
    );
  } catch (error) {
    const message = getErrorMessage(error);
    const errorKind = getErrorKind(error);
    const finalAttempt = isFinalAttempt(job);
    const retrying = errorKind === "retryable" && !finalAttempt;
    const durationMs = Date.now() - startedAt;

    console.error(
      `[image-processing] failed jobId=${jobId} imageId=${imageId} attempt=${attempt}/${maximumAttempts} kind=${errorKind} retrying=${retrying} durationMs=${durationMs} error="${message}"`,
    );

    if (errorKind === "permanent") {
      await imageRepository.updateProcessingStatus(imageId, "failed");
      await repository.markFailed(jobId, message);
      throw new UnrecoverableError(message);
    }

    if (finalAttempt) {
      await imageRepository.updateProcessingStatus(imageId, "failed");
      await repository.markFailed(jobId, message);
    }

    throw error;
  }
}

export function createImageProcessingWorker(
  repository: JobRepository = jobRepository,
  processingService: ImageProcessingService = createImageProcessingService(),
): Worker<ImageProcessingJobData> {
  const worker = new Worker<ImageProcessingJobData>(
    IMAGE_PROCESSING_QUEUE_NAME,
    (job) =>
      processImageProcessingJob(
        job,
        repository,
        processingService,
      ),
    {
      connection: redisConnection,
    },
  );

  return worker;
}

export async function closeImageProcessingWorker(
  worker: Worker<ImageProcessingJobData>,
): Promise<void> {
  await worker.close();
}