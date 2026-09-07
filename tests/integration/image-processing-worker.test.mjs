import assert from "node:assert/strict";
import test from "node:test";

import {
  closeDatabasePool,
} from "../../dist/infrastructure/database.js";
import {
  closeRedisConnection,
} from "../../dist/infrastructure/redis.js";
import {
  closeImageProcessingQueue,
  imageProcessingQueue,
} from "../../dist/infrastructure/image-processing-queue.js";
import {
  closeImageProcessingWorker,
  createImageProcessingWorker,
} from "../../dist/workers/image-processing-worker.js";
import { jobRepository } from "../../dist/repositories/jobs.js";
import { imageRepository } from "../../dist/repositories/images.js";

test("worker processes a queued PostgreSQL job", async () => {
  const processingService = {
    async processImage(input) {
      assert.ok(input.imageId);
    },
  };

  const worker = createImageProcessingWorker(
    jobRepository,
    processingService,
  );

  try {
    await worker.waitUntilReady();
    await imageProcessingQueue.waitUntilReady();

    const image = await imageRepository.create({
      sourceUrl: "https://example.com/test-image.jpg",
    });

    const databaseJob = await jobRepository.create({
      type: "image-processing",
    });

    const completionPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Timed out waiting for BullMQ worker completion."));
      }, 10_000);

      worker.once("completed", (job) => {
        if (job.id === databaseJob.id) {
          clearTimeout(timeout);
          resolve(job);
        }
      });

      worker.once("failed", (job, error) => {
        if (job?.id === databaseJob.id) {
          clearTimeout(timeout);
          reject(error);
        }
      });
    });

    await imageProcessingQueue.add(
      "process-image",
      {
        jobId: databaseJob.id,
        imageId: image.id,
      },
      {
        jobId: databaseJob.id,
      },
    );

    const completedJob = await completionPromise;

    assert.equal(completedJob.id, databaseJob.id);

    const finalDatabaseJob = await jobRepository.findById(databaseJob.id);

    assert.ok(finalDatabaseJob);
    assert.equal(finalDatabaseJob.status, "completed");
    assert.equal(finalDatabaseJob.attempts, 1);
    assert.ok(finalDatabaseJob.startedAt);
    assert.ok(finalDatabaseJob.completedAt);

    const finalImage = await imageRepository.findById(image.id);

    assert.ok(finalImage);
    assert.equal(finalImage.processingStatus, "completed");
  } finally {
    await closeImageProcessingWorker(worker);
  }
});

test.after(async () => {
  await closeImageProcessingQueue();
  await closeRedisConnection();
  await closeDatabasePool();
});