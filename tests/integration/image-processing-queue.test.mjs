import assert from "node:assert/strict";
import test from "node:test";

import {
  closeRedisConnection,
  redisConnection,
} from "../../dist/infrastructure/redis.js";
import {
  closeImageProcessingQueue,
  imageProcessingQueue,
  IMAGE_PROCESSING_QUEUE_NAME,
} from "../../dist/infrastructure/image-processing-queue.js";

test("image processing queue accepts and stores a job payload", async () => {
  const job = await imageProcessingQueue.add(
    "process-image",
    {
      jobId: "00000000-0000-0000-0000-000000000001",
      imageId: "00000000-0000-0000-0000-000000000002",
    },
    {
      jobId: "stage-15-queue-test",
    },
  );

  try {
    assert.equal(job.queueName, IMAGE_PROCESSING_QUEUE_NAME);
    assert.equal(job.name, "process-image");
    assert.deepEqual(job.data, {
      jobId: "00000000-0000-0000-0000-000000000001",
      imageId: "00000000-0000-0000-0000-000000000002",
    });

    const storedJob = await imageProcessingQueue.getJob(
      "stage-15-queue-test",
    );

    assert.ok(storedJob);
    assert.equal(storedJob.id, "stage-15-queue-test");
    assert.deepEqual(storedJob.data, job.data);
  } finally {
    await imageProcessingQueue.remove("stage-15-queue-test");
  }
});

test.after(async () => {
  await closeImageProcessingQueue();
  await closeRedisConnection();
});