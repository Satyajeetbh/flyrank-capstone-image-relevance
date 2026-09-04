import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { closeDatabasePool, pool } from "../../dist/infrastructure/database.js";
import { imageRepository } from "../../dist/repositories/images.js";
import { aiUsageRepository } from "../../dist/repositories/ai-usage.js";

test("persists and retrieves AI usage for an image", async () => {
  const runId = randomUUID();
  let imageId;
  let usageId;

  try {
    const image = await imageRepository.create({
      sourceUrl: `https://example.test/ai-usage/${runId}.jpg`,
    });
    imageId = image.id;

    const usage = await aiUsageRepository.create({
      entityType: "image",
      entityId: image.id,
      operation: "vision_understanding",
      usage: {
        provider: "openai",
        model: "gpt-4.1-mini",
        inputUnits: 120,
        outputUnits: 30,
      },
      estimatedCost: 0.012345,
    });
    usageId = usage.id;

    const foundById = await aiUsageRepository.findById(usage.id);
    assert.equal(foundById?.entityType, "image");
    assert.equal(foundById?.entityId, image.id);
    assert.equal(foundById?.operation, "vision_understanding");
    assert.equal(foundById?.provider, "openai");
    assert.equal(foundById?.model, "gpt-4.1-mini");
    assert.equal(foundById?.inputUnits, 120);
    assert.equal(foundById?.outputUnits, 30);
    assert.equal(foundById?.estimatedCost, 0.012345);
    assert.equal(foundById?.status, "completed");

    const foundByEntity = await aiUsageRepository.findByEntity("image", image.id);
    assert.equal(foundByEntity.length, 1);
    assert.equal(foundByEntity[0].id, usage.id);
  } finally {
    try {
      if (usageId) {
        await pool.query("DELETE FROM ai_usage WHERE id = $1", [usageId]);
      }
      if (imageId) {
        await pool.query("DELETE FROM images WHERE id = $1", [imageId]);
      }
    } finally {
      await closeDatabasePool();
    }
  }
});
