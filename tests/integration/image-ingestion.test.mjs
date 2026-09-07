import assert from "node:assert/strict";
import test from "node:test";
import express from "express";

import {
  closeRedisConnection,
} from "../../dist/infrastructure/redis.js";
import {
  closeImageProcessingQueue,
  imageProcessingQueue,
} from "../../dist/infrastructure/image-processing-queue.js";
import {
  closeDatabasePool,
  pool,
} from "../../dist/infrastructure/database.js";
import {
  createImageIngestionRouter,
} from "../../dist/api/image-ingestion.js";

const app = express();
app.use(express.json());
app.use(createImageIngestionRouter());

function requestJson(body) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, async () => {
      const address = server.address();

      try {
        const response = await fetch(
          `http://127.0.0.1:${address.port}/images`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
          },
        );

        const responseBody = await response.json();

        resolve({
          status: response.status,
          body: responseBody,
        });
      } catch (error) {
        reject(error);
      } finally {
        server.close();
      }
    });
  });
}

test("POST /images rejects invalid image input", async () => {
  const response = await requestJson({
    sourceUrl: "not-a-url",
  });

  assert.equal(response.status, 400);
  assert.equal(response.body.error, "Invalid image input.");
});

test("POST /images creates an image and queues processing", async () => {
  const sourceUrl = "https://example.com/ingestion-test.jpg";

  const response = await requestJson({
    sourceUrl,
  });

  assert.equal(response.status, 201);
  assert.equal(response.body.image.sourceUrl, sourceUrl);
  assert.equal(response.body.image.processingStatus, "pending");

  assert.ok(response.body.image.id);
  assert.ok(response.body.job.jobId);
  assert.equal(response.body.job.imageId, response.body.image.id);

  const imageResult = await pool.query(
    `
      SELECT id, source_url, processing_status
      FROM images
      WHERE id = $1
    `,
    [response.body.image.id],
  );

  assert.equal(imageResult.rows.length, 1);
  assert.equal(imageResult.rows[0].source_url, sourceUrl);
  assert.equal(imageResult.rows[0].processing_status, "pending");

  const queueJob = await imageProcessingQueue.getJob(
    response.body.job.jobId,
  );

  assert.ok(queueJob);
  assert.equal(queueJob.id, response.body.job.jobId);
  assert.equal(queueJob.name, "process-image");
  assert.deepEqual(queueJob.data, {
    jobId: response.body.job.jobId,
    imageId: response.body.image.id,
  });
});

test.after(async () => {
  await closeImageProcessingQueue();
  await closeRedisConnection();
  await closeDatabasePool();
});