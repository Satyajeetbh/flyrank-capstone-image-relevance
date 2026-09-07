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
import {
  imageMetadataRepository,
} from "../../dist/repositories/image-metadata.js";
import {
  imageEmbeddingRepository,
} from "../../dist/repositories/image-embeddings.js";
import {
  aiUsageRepository,
} from "../../dist/repositories/ai-usage.js";
import {
  OPENAI_EMBEDDING_MODEL,
} from "../../dist/providers/openai-embeddings.js";
import {
  OpenAIVisionError,
} from "../../dist/providers/openai-vision.js";

const TEST_EMBEDDING = Array.from({ length: 1536 }, () => 0.001);

function createSuccessfulProcessingService(counters) {
  return {
    async processImage(input) {
      counters.processCalls += 1;

      return {
        imageId: input.imageId,
        metadata: {
          subject: "red fox",
          category: "animal",
          attributes: ["orange fur", "wild"],
          caption: "A red fox in a forest.",
          confidence: 0.95,
        },
        embeddingModel: OPENAI_EMBEDDING_MODEL,
      };
    },
  };
}

test("retryable worker failure can be retried successfully", async () => {
  const image = await imageRepository.create({
    sourceUrl: "https://example.com/retry-test.jpg",
  });

  const databaseJob = await jobRepository.create({
    type: "image-processing",
  });

  let calls = 0;

  const processingService = {
    async processImage() {
      calls += 1;

      if (calls === 1) {
        throw new Error("Temporary provider failure.");
      }

      return {
        imageId: image.id,
        metadata: {
          subject: "red fox",
          category: "animal",
          attributes: ["orange fur"],
          caption: "A red fox in a forest.",
          confidence: 0.95,
        },
        embeddingModel: OPENAI_EMBEDDING_MODEL,
      };
    },
  };

  const worker = createImageProcessingWorker(
    jobRepository,
    processingService,
  );

  try {
    await worker.waitUntilReady();
    await imageProcessingQueue.waitUntilReady();

    const completionPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Timed out waiting for retry completion."));
      }, 10_000);

      worker.once("completed", (job) => {
        if (job.id === databaseJob.id) {
          clearTimeout(timeout);
          resolve(job);
        }
      });

      worker.once("failed", (job, error) => {
        if (job?.id === databaseJob.id && job.attemptsMade >= 2) {
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
        attempts: 2,
        backoff: {
          type: "fixed",
          delay: 100,
        },
      },
    );

    await completionPromise;

    assert.equal(calls, 2);

    const finalJob = await jobRepository.findById(databaseJob.id);

    assert.ok(finalJob);
    assert.equal(finalJob.status, "completed");
    assert.equal(finalJob.attempts, 2);

    const finalImage = await imageRepository.findById(image.id);

    assert.ok(finalImage);
    assert.equal(finalImage.processingStatus, "completed");
  } finally {
    await closeImageProcessingWorker(worker);
  }
});

test("existing metadata is reused instead of reprocessing vision", async () => {
  const image = await imageRepository.create({
    sourceUrl: "https://example.com/metadata-idempotency.jpg",
  });

  await imageMetadataRepository.save(image.id, {
    subject: "red fox",
    category: "animal",
    attributes: ["orange fur"],
    caption: "A red fox in a forest.",
    confidence: 0.95,
  });

  const counters = {
    processCalls: 0,
  };

  const processingService =
    createSuccessfulProcessingService(counters);

  const worker = createImageProcessingWorker(
    jobRepository,
    processingService,
  );

  try {
    const databaseJob = await jobRepository.create({
      type: "image-processing",
    });

    await worker.waitUntilReady();
    await imageProcessingQueue.waitUntilReady();

    const completionPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(async () => {
        const queuedJob = await imageProcessingQueue.getJob(databaseJob.id);
    
        if (!queuedJob) {
          reject(
            new Error(
              `Timed out waiting for retry completion. BullMQ job ${databaseJob.id} no longer exists.`,
            ),
          );
          return;
        }
    
        const state = await queuedJob.getState();
    
        reject(
          new Error(
            [
              "Timed out waiting for retry completion.",
              `state=${state}`,
              `attemptsMade=${queuedJob.attemptsMade}`,
              `configuredAttempts=${queuedJob.opts.attempts}`,
            ].join(" "),
          ),
        );
      }, 10_000);
    
      worker.on("completed", function onCompleted(job) {
        if (job.id === databaseJob.id) {
          clearTimeout(timeout);
          worker.off("completed", onCompleted);
          resolve(job);
        }
      });
    
      worker.on("failed", function onFailed(job, error) {
        if (job?.id === databaseJob.id) {
          console.log(
            `retry test failed event: attemptsMade=${job.attemptsMade}, configuredAttempts=${job.opts.attempts}, error=${error.message}`,
          );
        }
      });
    });


    console.log("POSTGRES JOB ID:", databaseJob.id);
    
    const existingBullMqJob = await imageProcessingQueue.getJob(databaseJob.id);
    
    console.log(
      "EXISTING BULLMQ JOB:",
      existingBullMqJob
        ? {
            id: existingBullMqJob.id,
            name: existingBullMqJob.name,
            attemptsMade: existingBullMqJob.attemptsMade,
            state: await existingBullMqJob.getState(),
          }
        : null,
    );
    
    const bullMqJob = await imageProcessingQueue.add(
      "process-image",
      {
        jobId: databaseJob.id,
        imageId: image.id,
      },
      {
        jobId: databaseJob.id,
      },
    );

    console.log("ADDED BULLMQ JOB:", {
      id: bullMqJob.id,
      name: bullMqJob.name,
      attempts: bullMqJob.opts.attempts,
    });

    await completionPromise;

    assert.equal(counters.processCalls, 1);
  } finally {
    await closeImageProcessingWorker(worker);
  }
});

test("existing embedding can be detected for retry-safe persistence", async () => {
  const image = await imageRepository.create({
    sourceUrl: "https://example.com/embedding-idempotency.jpg",
  });

  const metadata = {
    subject: "red fox",
    category: "animal",
    attributes: ["orange fur"],
    caption: "A red fox in a forest.",
    confidence: 0.95,
  };

  await imageMetadataRepository.save(image.id, metadata);

  await imageEmbeddingRepository.save(
    image.id,
    OPENAI_EMBEDDING_MODEL,
    TEST_EMBEDDING,
  );

  const existingEmbedding =
    await imageEmbeddingRepository.findByImageId(
      image.id,
      OPENAI_EMBEDDING_MODEL,
    );

  assert.ok(existingEmbedding);
  assert.deepEqual(existingEmbedding.embedding, TEST_EMBEDDING);
});

test("permanent worker failure marks the job and image as failed", async () => {
  const image = await imageRepository.create({
    sourceUrl: "https://example.com/permanent-failure.jpg",
  });

  const databaseJob = await jobRepository.create({
    type: "image-processing",
  });

  const processingService = {
    async processImage() {
      const { ImageProcessingJobError } =
        await import("../../dist/domain/job-errors.js");

      throw new ImageProcessingJobError(
        "Image metadata is permanently invalid.",
        "permanent",
      );
    },
  };

  const worker = createImageProcessingWorker(
    jobRepository,
    processingService,
  );

  try {
    await worker.waitUntilReady();
    await imageProcessingQueue.waitUntilReady();

    const failurePromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Timed out waiting for permanent failure."));
      }, 10_000);

      worker.once("failed", (job, error) => {
        if (job?.id === databaseJob.id) {
          clearTimeout(timeout);
          resolve(error);
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
        attempts: 3,
      },
    );

    const error = await failurePromise;

    assert.equal(error.message, "Image metadata is permanently invalid.");

    const finalJob = await jobRepository.findById(databaseJob.id);

    assert.ok(finalJob);
    assert.equal(finalJob.status, "failed");
    assert.equal(finalJob.attempts, 1);
    assert.equal(
      finalJob.error,
      "Image metadata is permanently invalid.",
    );

    const finalImage = await imageRepository.findById(image.id);

    assert.ok(finalImage);
    assert.equal(finalImage.processingStatus, "failed");
  } finally {
    await closeImageProcessingWorker(worker);
  }
});

test("invalid model output is treated as permanent and is not retried", async () => {
  const image = await imageRepository.create({
    sourceUrl: "https://example.com/invalid-output.jpg",
  });

  const databaseJob = await jobRepository.create({
    type: "image-processing",
  });

  let calls = 0;

  const processingService = {
    async processImage() {
      calls += 1;

      throw new OpenAIVisionError(
        "OpenAI vision output failed metadata validation.",
        "invalid_model_output",
      );
    },
  };

  const worker = createImageProcessingWorker(
    jobRepository,
    processingService,
  );

  try {
    await worker.waitUntilReady();
    await imageProcessingQueue.waitUntilReady();

    const failurePromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Timed out waiting for invalid-output failure."));
      }, 10_000);

      worker.once("failed", (job, error) => {
        if (job?.id === databaseJob.id) {
          clearTimeout(timeout);
          resolve(error);
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
        attempts: 3,
      },
    );

    const error = await failurePromise;

    assert.equal(
      error.message,
      "OpenAI vision output failed metadata validation.",
    );

    assert.equal(calls, 1);

    const finalJob = await jobRepository.findById(databaseJob.id);

    assert.ok(finalJob);
    assert.equal(finalJob.status, "failed");
    assert.equal(finalJob.attempts, 1);
    assert.equal(
      finalJob.error,
      "OpenAI vision output failed metadata validation.",
    );

    const finalImage = await imageRepository.findById(image.id);

    assert.ok(finalImage);
    assert.equal(finalImage.processingStatus, "failed");
  } finally {
    await closeImageProcessingWorker(worker);
  }
});

test.after(async () => {
  await closeImageProcessingQueue();
  await closeRedisConnection();
  await closeDatabasePool();
});