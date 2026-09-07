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
import { OpenAIVisionError,OpenAIVisionProvider } from "../providers/openai-vision.js";
import { OpenAIEmbeddingProvider } from "../providers/openai-embeddings.js";

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

export function createImageProcessingService(): ImageProcessingService {
  return new ImageProcessingService(
    imageRepository,
    new OpenAIVisionProvider(),
    new OpenAIEmbeddingProvider(),
  );
}

export async function processImageProcessingJob(
  job: Job<ImageProcessingJobData>,
  repository: JobRepository,
  processingService: ImageProcessingService,
): Promise<void> {
  const { jobId, imageId } = job.data;

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

    await processingService.processImage({
      imageId,
    });

    await imageRepository.updateProcessingStatus(imageId, "completed");
    await repository.markCompleted(jobId);
  } catch (error) {
      const message = getErrorMessage(error);
      const errorKind = getErrorKind(error);
  
      if (errorKind === "permanent") {
        await imageRepository.updateProcessingStatus(imageId, "failed");
        await repository.markFailed(jobId, message);

        throw new UnrecoverableError(message);
      }
  
      if (isFinalAttempt(job)) {
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

  worker.on("failed", (job, error) => {
    if (job) {
      console.error(
        `Image processing job ${job.id} failed: ${error.message}`,
      );
    }
  });

  return worker;
}

export async function closeImageProcessingWorker(
  worker: Worker<ImageProcessingJobData>,
): Promise<void> {
  await worker.close();
}