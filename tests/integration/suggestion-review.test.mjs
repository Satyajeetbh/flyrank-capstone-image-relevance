import assert from "node:assert/strict";
import express from "express";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { createSuggestionReviewRouter } from "../../dist/api/suggestion-review.js";
import { closeDatabasePool, pool } from "../../dist/infrastructure/database.js";
import { imageRepository } from "../../dist/repositories/images.js";
import { postRepository } from "../../dist/repositories/posts.js";
import { reviewRepository } from "../../dist/repositories/reviews.js";
import { suggestionRepository } from "../../dist/repositories/suggestions.js";

async function startServer() {
  const app = express();
  app.use(express.json());
  app.use(createSuggestionReviewRouter());

  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");

  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}

async function requestJson(baseUrl, path, options) {
  const response = await fetch(`${baseUrl}${path}`, options);
  return { status: response.status, body: await response.json() };
}

test("supports inspecting and recording human decisions for a suggestion", async () => {
  const runId = randomUUID();
  let imageId;
  let postId;
  let server;

  try {
    const image = await imageRepository.create({
      sourceUrl: `https://example.test/reviews/${runId}.jpg`,
      processingStatus: "completed",
    });
    imageId = image.id;

    await pool.query(
      `
        INSERT INTO image_metadata (
          image_id, subject, category, attributes, caption, vision_confidence, review_status
        )
        VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7)
      `,
      [image.id, "red fox", "animal", '["fur", "outdoors"]', "A red fox outdoors.", 0.84, "needs_review"],
    );

    const post = await postRepository.create({
      title: `Review post ${runId}`,
      content: "A post awaiting human review.",
      expectedSubject: "red fox",
      expectedCategory: "animal",
    });
    postId = post.id;

    const suggestion = await suggestionRepository.create({
      postId: post.id,
      imageId: image.id,
      similarityScore: 0.91,
      guardStatus: "review",
      reason: "Vision confidence requires review.",
    });
    await reviewRepository.create({
      suggestionId: suggestion.id,
      decision: "needs_review",
      reviewer: "system-review-queue",
      reason: "Queued for human review.",
    });

    const started = await startServer();
    server = started.server;

    const detail = await requestJson(started.baseUrl, `/suggestions/${suggestion.id}`);
    assert.equal(detail.status, 200);
    assert.equal(detail.body.id, suggestion.id);
    assert.deepEqual(detail.body.post, {
      id: post.id,
      title: post.title,
      content: post.content,
      expectedSubject: post.expectedSubject,
      expectedCategory: post.expectedCategory,
    });
    assert.deepEqual(detail.body.image, {
      id: image.id,
      sourceUrl: image.sourceUrl,
      metadata: {
        subject: "red fox",
        category: "animal",
        attributes: ["fur", "outdoors"],
        caption: "A red fox outdoors.",
        visionConfidence: 0.84,
      },
    });
    assert.equal(detail.body.similarityScore, 0.91);
    assert.equal(detail.body.guardStatus, "review");
    assert.equal(detail.body.reviews.length, 1);
    assert.equal(detail.body.reviews[0].decision, "needs_review");

    const invalidUuid = await requestJson(started.baseUrl, "/suggestions/not-a-uuid");
    assert.equal(invalidUuid.status, 400);

    const unknownSuggestion = await requestJson(started.baseUrl, `/suggestions/${randomUUID()}`);
    assert.equal(unknownSuggestion.status, 404);

    const approval = await requestJson(started.baseUrl, `/suggestions/${suggestion.id}/approve`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reviewer: "alice" }),
    });
    assert.equal(approval.status, 201);
    assert.equal(approval.body.review.decision, "approved");
    assert.equal(approval.body.review.reviewer, "alice");
    assert.equal(approval.body.review.reason, null);

    const invalidRejection = await requestJson(started.baseUrl, `/suggestions/${suggestion.id}/reject`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reviewer: "bob", reason: " " }),
    });
    assert.equal(invalidRejection.status, 400);

    const rejection = await requestJson(started.baseUrl, `/suggestions/${suggestion.id}/reject`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reviewer: "bob", reason: "Image does not meet the human review criteria." }),
    });
    assert.equal(rejection.status, 201);
    assert.equal(rejection.body.review.decision, "rejected");
    assert.equal(rejection.body.review.reason, "Image does not meet the human review criteria.");

    const unchangedSuggestion = await pool.query(
      "SELECT guard_status FROM suggestions WHERE id = $1",
      [suggestion.id],
    );
    assert.equal(unchangedSuggestion.rows[0].guard_status, "review");
  } finally {
    if (server) {
      await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    }

    try {
      if (postId) {
        await pool.query("DELETE FROM posts WHERE id = $1", [postId]);
      }
      if (imageId) {
        await pool.query("DELETE FROM images WHERE id = $1", [imageId]);
      }
    } finally {
      await closeDatabasePool();
    }
  }
});
