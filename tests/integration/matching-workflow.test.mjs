import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { SemanticImageRetrievalService } from "../../dist/application/semantic-image-retrieval.js";
import { pool } from "../../dist/infrastructure/database.js";
import { imageEmbeddingRepository } from "../../dist/repositories/image-embeddings.js";
import { imageRepository } from "../../dist/repositories/images.js";
import { postEmbeddingRepository } from "../../dist/repositories/post-embeddings.js";
import { postRepository } from "../../dist/repositories/posts.js";
import { getEmbeddingModel } from "../../dist/providers/embedding-config.js";

const EMBEDDING_MODEL = getEmbeddingModel();
const DIMENSIONS = 1536;
const tolerance = 1e-6;

function vector(first, second) {
  return [first, second, ...Array(DIMENSIONS - 2).fill(0)];
}

async function createCandidate(runId, label, subject, category, confidence) {
  const image = await imageRepository.create({
    sourceUrl: `https://example.test/matching/${runId}/${label}.jpg`,
    processingStatus: "completed",
  });

  await pool.query(
    `
      INSERT INTO image_metadata (
        image_id, subject, category, attributes, caption, vision_confidence, review_status
      )
      VALUES ($1, $2, $3, '[]'::jsonb, $4, $5, 'needs_review')
    `,
    [image.id, subject, category, `${subject} image.`, confidence],
  );

  return image;
}

test("selects the highest-ranked candidate accepted by the mismatch guard", async () => {
  const runId = randomUUID();
  const imageIds = [];
  const postIds = [];

  try {
    const post = await postRepository.create({
      title: `Matching workflow ${runId}`,
      content: "Matching workflow integration test.",
      expectedSubject: "fox",
      expectedCategory: "animal",
    });
    postIds.push(post.id);
    await postEmbeddingRepository.save(post.id, EMBEDDING_MODEL, vector(1, 0));

    const rejectedSubject = await createCandidate(runId, "rejected-subject", "wolf", "animal", 0.95);
    const accepted = await createCandidate(runId, "accepted", "fox", "animal", 0.95);
    const review = await createCandidate(runId, "review", "fox", "animal", 0.2);
    const lowSimilarity = await createCandidate(runId, "low-similarity", "fox", "animal", 0.95);
    imageIds.push(rejectedSubject.id, accepted.id, review.id, lowSimilarity.id);

    await imageEmbeddingRepository.save(rejectedSubject.id, EMBEDDING_MODEL, vector(1, 0));
    await imageEmbeddingRepository.save(accepted.id, EMBEDDING_MODEL, vector(0.99, 0.141067));
    await imageEmbeddingRepository.save(review.id, EMBEDDING_MODEL, vector(0.98, 0.198997));
    await imageEmbeddingRepository.save(lowSimilarity.id, EMBEDDING_MODEL, vector(0, 1));

    const service = new SemanticImageRetrievalService();
    const result = await service.match(post.id, 4);

    assert.equal(result.decision, "ACCEPT");
    assert.equal(result.recommendation?.imageId, accepted.id);
    assert.equal(result.recommendation?.guardDecision, "ACCEPT");
    assert.equal(result.recommendation?.reasonCode, null);
    assert.deepEqual(
      result.alternatives.map((candidate) => [candidate.imageId, candidate.guardDecision, candidate.reasonCode]),
      [
        [rejectedSubject.id, "REJECT", "SUBJECT_MISMATCH"],
        [review.id, "REVIEW", "LOW_VISION_CONFIDENCE"],
        [lowSimilarity.id, "REJECT", "SIMILARITY_TOO_LOW"],
      ],
    );
    assert.ok(Math.abs(result.recommendation.similarity - 0.99) < tolerance);

    const persistedSuggestions = await pool.query(
      `
        SELECT id, image_id, similarity_score, guard_status, reason
        FROM suggestions
        WHERE post_id = $1
      `,
      [post.id],
    );
    assert.equal(persistedSuggestions.rows.length, 4);

    const suggestionsByImage = new Map(
      persistedSuggestions.rows.map((suggestion) => [suggestion.image_id, suggestion]),
    );
    assert.equal(result.recommendation.suggestionId, suggestionsByImage.get(accepted.id).id);
    assert.equal(suggestionsByImage.get(accepted.id).guard_status, "accept");
    assert.equal(suggestionsByImage.get(accepted.id).reason, result.recommendation.reason);
    assert.equal(suggestionsByImage.get(rejectedSubject.id).guard_status, "reject");
    assert.equal(suggestionsByImage.get(rejectedSubject.id).reason, "Animal category mismatch: expected fox, detected wolf.");
    assert.equal(suggestionsByImage.get(review.id).guard_status, "review");
    assert.equal(suggestionsByImage.get(review.id).reason, "Vision confidence is below 0.7.");
    assert.equal(suggestionsByImage.get(lowSimilarity.id).guard_status, "reject");

    const noMatchPost = await postRepository.create({
      title: `No confident match ${runId}`,
      content: "No confident match integration test.",
      expectedSubject: "cat",
      expectedCategory: "animal",
    });
    postIds.push(noMatchPost.id);
    await postEmbeddingRepository.save(noMatchPost.id, EMBEDDING_MODEL, vector(1, 0));

    const noMatchResult = await service.match(noMatchPost.id, 4);
    assert.equal(noMatchResult.decision, "NO_CONFIDENT_MATCH");
    assert.equal(noMatchResult.recommendation, null);
    assert.equal(noMatchResult.alternatives.length, 4);

    const noMatchSuggestions = await pool.query(
      "SELECT id FROM suggestions WHERE post_id = $1",
      [noMatchPost.id],
    );
    assert.equal(noMatchSuggestions.rows.length, 4);
    assert.deepEqual(
      noMatchResult.alternatives.map((candidate) => candidate.suggestionId).sort(),
      noMatchSuggestions.rows.map((suggestion) => suggestion.id).sort(),
    );
  } finally {
      for (const postId of postIds) {
        await pool.query("DELETE FROM posts WHERE id = $1", [postId]);
      }
      for (const imageId of imageIds) {
        await pool.query("DELETE FROM images WHERE id = $1", [imageId]);
      }
  }
});
