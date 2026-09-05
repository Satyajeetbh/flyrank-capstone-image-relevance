import assert from "node:assert/strict";
import test from "node:test";

import { closeDatabasePool, pool } from "../../dist/infrastructure/database.js";
import { JobRepository } from "../../dist/repositories/jobs.js";

const repository = new JobRepository();

test("job repository persists and transitions job state", async () => {
  const created = await repository.create({
    type: "image_processing",
  });

  try {
    assert.equal(created.type, "image_processing");
    assert.equal(created.status, "queued");
    assert.equal(created.attempts, 0);
    assert.equal(created.error, null);
    assert.equal(created.startedAt, null);
    assert.equal(created.completedAt, null);

    const found = await repository.findById(created.id);

    assert.ok(found);
    assert.equal(found.id, created.id);
    assert.equal(found.status, "queued");

    const running = await repository.markRunning(created.id);

    assert.ok(running);
    assert.equal(running.status, "running");
    assert.equal(running.attempts, 1);
    assert.ok(running.startedAt);
    assert.equal(running.error, null);

    const completed = await repository.markCompleted(created.id);

    assert.ok(completed);
    assert.equal(completed.status, "completed");
    assert.equal(completed.attempts, 1);
    assert.ok(completed.startedAt);
    assert.ok(completed.completedAt);
    assert.equal(completed.error, null);

    const finalRecord = await repository.findById(created.id);

    assert.ok(finalRecord);
    assert.equal(finalRecord.status, "completed");
    assert.equal(finalRecord.attempts, 1);
  } finally {
    await pool.query("DELETE FROM jobs WHERE id = $1", [created.id]);
  }
});

test("job repository records a failed job with an error", async () => {
  const created = await repository.create({
    type: "image_processing",
  });

  try {
    const running = await repository.markRunning(created.id);

    assert.ok(running);
    assert.equal(running.attempts, 1);

    const failed = await repository.markFailed(
      created.id,
      "Image could not be processed.",
    );

    assert.ok(failed);
    assert.equal(failed.status, "failed");
    assert.equal(failed.attempts, 1);
    assert.equal(failed.error, "Image could not be processed.");
    assert.ok(failed.startedAt);
    assert.ok(failed.completedAt);
  } finally {
    await pool.query("DELETE FROM jobs WHERE id = $1", [created.id]);
  }
});

test.after(async () => {
  await closeDatabasePool();
});