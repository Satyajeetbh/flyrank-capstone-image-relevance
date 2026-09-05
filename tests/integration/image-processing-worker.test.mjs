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
  imageProcessingWorker,
} from "../../dist/workers/image-processing-worker.js";
import { jobRepository } from "../../dist/repositories/jobs.js";

test("worker processes a queued PostgreSQL job", async () => {
  await imageProcessingWorker.waitUntilReady();
  await imageProcessingQueue.waitUntilReady();
  
  const databaseJob = await jobRepository.create({
    type: "image-processing",
  });

  const completionPromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Timed out waiting for BullMQ worker completion."));
    }, 10_000);

    imageProcessingWorker.once("completed", (job) => {
      if (job.id === databaseJob.id) {
        clearTimeout(timeout);
        resolve(job);
      }
    });

    imageProcessingWorker.once("failed", (job, error) => {
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
      imageId: "00000000-0000-0000-0000-000000000002",
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
});

test.after(async () => {
  await closeImageProcessingWorker();
  await closeImageProcessingQueue();
  await closeRedisConnection();
  await closeDatabasePool();
});