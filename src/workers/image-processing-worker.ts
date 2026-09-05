import { Worker, type Job } from "bullmq";

import {
  IMAGE_PROCESSING_QUEUE_NAME,
  type ImageProcessingJobData,
} from "../infrastructure/image-processing-queue.js";
import { redisConnection } from "../infrastructure/redis.js";
import { ImageProcessingJobError } from "../domain/job-errors.js";
import {
  jobRepository,
  type JobRepository,
} from "../repositories/jobs.js";

function isFinalAttempt(job: Job<ImageProcessingJobData>): boolean {
  const maximumAttempts = job.opts.attempts ?? 1;

  return job.attemptsMade + 1 >= maximumAttempts;
}

export async function processImageProcessingJob(
  job: Job<ImageProcessingJobData>,
  repository: JobRepository,
): Promise<void> {
  const databaseJob = await repository.findById(job.data.jobId);

  if (!databaseJob) {
    throw new ImageProcessingJobError(
      `Database job ${job.data.jobId} was not found.`,
      "permanent",
    );
  }

  const runningJob = await repository.markRunning(job.data.jobId);

  if (!runningJob) {
    throw new ImageProcessingJobError(
      `Database job ${job.data.jobId} could not be marked running.`,
      "permanent",
    );
  }

  try {
    // Stage 15 deliberately stops here.
    // Stage 16 will replace this with the actual image-processing pipeline.

    await repository.markCompleted(job.data.jobId);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Image processing failed.";

    if (isFinalAttempt(job)) {
      await repository.markFailed(job.data.jobId, message);
    }

    throw error;
  }
}

async function processImageProcessingJobWithRepository(
  job: Job<ImageProcessingJobData>,
): Promise<void> {
  return processImageProcessingJob(job, jobRepository);
}

export const imageProcessingWorker = new Worker<ImageProcessingJobData>(
  IMAGE_PROCESSING_QUEUE_NAME,
  processImageProcessingJobWithRepository,
  {
    connection: redisConnection,
  },
);

imageProcessingWorker.on("failed", (job, error) => {
  if (job) {
    console.error(
      `Image processing job ${job.id} failed: ${error.message}`,
    );
  }
});

export async function closeImageProcessingWorker(): Promise<void> {
  await imageProcessingWorker.close();
}