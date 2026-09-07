import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { SemanticImageRetrievalService } from "../../dist/application/semantic-image-retrieval.js";
import { pool } from "../../dist/infrastructure/database.js";
import { imageEmbeddingRepository } from "../../dist/repositories/image-embeddings.js";
import { imageRepository } from "../../dist/repositories/images.js";
import { postEmbeddingRepository } from "../../dist/repositories/post-embeddings.js";
import { postRepository } from "../../dist/repositories/posts.js";

const EMBEDDING_MODEL = "text-embedding-3-small";
const DIMENSIONS = 1536;
const tolerance = 1e-9;

function vector(first, second) {
  return [first, second, ...Array(DIMENSIONS - 2).fill(0)];
}

async function createRetrievableImage(runId, label, subject, category, reviewStatus = "approved") {
  const image = await imageRepository.create({
    sourceUrl: `https://example.test/retrieval/${runId}/${label}.jpg`,
    processingStatus: "completed",
  });

  await pool.query(
    `
      INSERT INTO image_metadata (
        image_id, subject, category, attributes, caption, vision_confidence, review_status
      )
      VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7)
    `,
    [image.id, subject, category, "[]", `${subject} image.`, 0.95, reviewStatus],
  );

  return image;
}

test("retrieves ranked semantic image candidates for a post", async () => {
  const runId = randomUUID();
  const imageIds = [];
  const postIds = [];

  try {
    const post = await postRepository.create({
      title: `Semantic retrieval ${runId}`,
      content: "Semantic retrieval integration test.",
      expectedSubject: "fox",
      expectedCategory: "animal",
    });
    postIds.push(post.id);
    await postEmbeddingRepository.save(post.id, EMBEDDING_MODEL, vector(1, 0));

    const exactImage = await createRetrievableImage(runId, "exact", "red fox", "animal");
    const closeImage = await createRetrievableImage(
      runId,
      "close",
      "fox",
      "animal",
      "needs_review",
    );
    const distantImage = await createRetrievableImage(runId, "distant", "mountain", "landscape");
    imageIds.push(exactImage.id, closeImage.id, distantImage.id);

    await imageEmbeddingRepository.save(exactImage.id, EMBEDDING_MODEL, vector(1, 0));
    await imageEmbeddingRepository.save(closeImage.id, EMBEDDING_MODEL, vector(1, 1));
    await imageEmbeddingRepository.save(distantImage.id, EMBEDDING_MODEL, vector(0, 1));

    const service = new SemanticImageRetrievalService();
    const result = await service.retrieve(post.id, 2);

    assert.equal(result.postId, post.id);
    assert.equal(result.candidates.length, 2);
    assert.deepEqual(
      result.candidates.map((candidate) => candidate.imageId),
      [exactImage.id, closeImage.id],
    );
    assert.ok(Math.abs(result.candidates[0].similarity - 1) < tolerance);
    assert.ok(Math.abs(result.candidates[1].similarity - Math.SQRT1_2) < tolerance);
    assert.equal(result.candidates[1].imageId, closeImage.id);
    assert.deepEqual(
      {
        subject: result.candidates[0].subject,
        category: result.candidates[0].category,
        visionConfidence: result.candidates[0].visionConfidence,
      },
      { subject: "red fox", category: "animal", visionConfidence: 0.95 },
    );

    const allCandidates = await service.retrieve(post.id, 5);
    assert.equal(allCandidates.candidates.length, 3);
    assert.ok(Math.abs(allCandidates.candidates[2].similarity) < tolerance);

    const postWithoutEmbedding = await postRepository.create({
      title: `Missing embedding ${runId}`,
      content: "Missing embedding integration test.",
      expectedSubject: "fox",
      expectedCategory: "animal",
    });
    postIds.push(postWithoutEmbedding.id);

    await assert.rejects(
      service.retrieve(postWithoutEmbedding.id),
      (error) =>
        typeof error === "object" &&
        error !== null &&
        "kind" in error &&
        error.kind === "post_embedding_not_found",
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

test("excludes completed images that have no embedding", async () => {
  const runId = randomUUID();
  const imageIds = [];
  const postIds = [];

  try {
    const post = await postRepository.create({
      title: `Missing image embedding ${runId}`,
      content: "Image without an embedding must not be retrieved.",
      expectedSubject: "fox",
      expectedCategory: "animal",
    });
    postIds.push(post.id);

    await postEmbeddingRepository.save(
      post.id,
      EMBEDDING_MODEL,
      vector(1, 0),
    );

    const image = await createRetrievableImage(
      runId,
      "no-embedding",
      "red fox",
      "animal",
    );
    imageIds.push(image.id);

    const service = new SemanticImageRetrievalService();
    const result = await service.retrieve(post.id, 5);

    assert.equal(result.candidates.length, 0);
  } finally {
      for (const postId of postIds) {
        await pool.query("DELETE FROM posts WHERE id = $1", [postId]);
      }

      for (const imageId of imageIds) {
        await pool.query("DELETE FROM images WHERE id = $1", [imageId]);
      }
  }
});
