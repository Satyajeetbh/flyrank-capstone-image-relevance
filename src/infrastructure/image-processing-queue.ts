import { Queue } from "bullmq";

import { redisConnection } from "./redis.js";

export const IMAGE_PROCESSING_QUEUE_NAME = "image-processing";

export interface ImageProcessingJobData {
  jobId: string;
  imageId: string;
}

export const imageProcessingQueue = new Queue<ImageProcessingJobData>(
  IMAGE_PROCESSING_QUEUE_NAME,
  {
    connection: redisConnection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 1_000,
      },
      removeOnComplete: 100,
      removeOnFail: 100,
    },
  },
);

export async function closeImageProcessingQueue(): Promise<void> {
  await imageProcessingQueue.close();
}