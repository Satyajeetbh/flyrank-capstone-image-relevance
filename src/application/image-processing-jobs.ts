import {
  imageProcessingQueue,
} from "../infrastructure/image-processing-queue.js";
import {
  jobRepository,
} from "../repositories/jobs.js";

export interface EnqueueImageProcessingInput {
  imageId: string;
}

export interface EnqueuedImageProcessingJob {
  jobId: string;
  imageId: string;
  queueJobId: string;
}

export async function enqueueImageProcessingJob(
  input: EnqueueImageProcessingInput,
): Promise<EnqueuedImageProcessingJob> {
  const job = await jobRepository.create({
    type: "image-processing",
  });

  try {
    const queueJob = await imageProcessingQueue.add(
      "process-image",
      {
        jobId: job.id,
        imageId: input.imageId,
      },
      {
        jobId: job.id,
      },
    );

    return {
      jobId: job.id,
      imageId: input.imageId,
      queueJobId: queueJob.id ?? job.id,
    };
  } catch (error) {
    await jobRepository.markFailed(
      job.id,
      error instanceof Error ? error.message : "Failed to enqueue image-processing job.",
    );

    throw error;
  }
}