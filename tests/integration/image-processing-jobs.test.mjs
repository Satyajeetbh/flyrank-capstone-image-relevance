import assert from "node:assert/strict";
import test from "node:test";

import {
  closeRedisConnection,
} from "../../dist/infrastructure/redis.js";
import {
  closeImageProcessingQueue,
  imageProcessingQueue,
} from "../../dist/infrastructure/image-processing-queue.js";
import {
  closeDatabasePool,
} from "../../dist/infrastructure/database.js";
import { jobRepository } from "../../dist/repositories/jobs.js";
import { enqueueImageProcessingJob } from "../../dist/application/image-processing-jobs.js";

test("enqueueImageProcessingJob creates a PostgreSQL job and matching BullMQ job", async () => {
  const result = await enqueueImageProcessingJob({
    imageId: "00000000-0000-0000-0000-000000000002",
  });

  const databaseJob = await jobRepository.findById(result.jobId);

  assert.ok(databaseJob);
  assert.equal(databaseJob.type, "image-processing");
  assert.equal(databaseJob.status, "queued");
  assert.equal(databaseJob.attempts, 0);

  const queueJob = await imageProcessingQueue.getJob(result.jobId);

  assert.ok(queueJob);
  assert.equal(queueJob.id, result.jobId);
  assert.equal(queueJob.name, "process-image");
  assert.deepEqual(queueJob.data, {
    jobId: result.jobId,
    imageId: result.imageId,
  });
});

test.after(async () => {
  await closeImageProcessingQueue();
  await closeRedisConnection();
  await closeDatabasePool();
});