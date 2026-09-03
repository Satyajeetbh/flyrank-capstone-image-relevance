import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { closeDatabasePool, pool } from "../../dist/infrastructure/database.js";
import { imageEmbeddingRepository } from "../../dist/repositories/image-embeddings.js";
import { postEmbeddingRepository } from "../../dist/repositories/post-embeddings.js";
import { imageRepository } from "../../dist/repositories/images.js";
import { postRepository } from "../../dist/repositories/posts.js";

const EMBEDDING_MODEL = "text-embedding-3-small";
const imageVector = Array.from({ length: 1536 }, (_, index) => index / 10_000);
const postVector = Array.from({ length: 1536 }, (_, index) => (index + 1) / 10_000);
const tolerance = 1e-12;

test("persists and retrieves image and post embeddings", async () => {
  const runId = randomUUID();
  let imageId;
  let postId;

  try {
    const image = await imageRepository.create({
      sourceUrl: `https://example.test/embedding-images/${runId}.jpg`,
      storageReference: `integration/${runId}.jpg`,
    });
    imageId = image.id;

    const savedImageEmbedding = await imageEmbeddingRepository.save(image.id, EMBEDDING_MODEL, imageVector);
    const foundImageEmbedding = await imageEmbeddingRepository.findByImageId(image.id, EMBEDDING_MODEL);

    assert.equal(savedImageEmbedding.imageId, image.id);
    assert.equal(savedImageEmbedding.embeddingModel, EMBEDDING_MODEL);
    assert.equal(foundImageEmbedding?.imageId, image.id);
    assert.equal(foundImageEmbedding?.embeddingModel, EMBEDDING_MODEL);
    assert.equal(foundImageEmbedding?.embedding.length, 1536);
    assert.ok(Math.abs(foundImageEmbedding.embedding[0] - imageVector[0]) < tolerance);
    assert.ok(Math.abs(foundImageEmbedding.embedding[512] - imageVector[512]) < tolerance);
    assert.equal(await imageEmbeddingRepository.findByImageId(randomUUID(), EMBEDDING_MODEL), null);
    await assert.rejects(
      imageEmbeddingRepository.save(image.id, EMBEDDING_MODEL, [0.1]),
      /exactly 1536 values/,
    );
    await assert.rejects(
      imageEmbeddingRepository.save(image.id, EMBEDDING_MODEL, [...imageVector.slice(0, 1535), Number.NaN]),
      /finite numbers/,
    );

    const post = await postRepository.create({
      title: `Embedding verification ${runId}`,
      content: "Post embedding integration verification content.",
      expectedSubject: "verification",
      expectedCategory: "integration",
    });
    postId = post.id;

    const savedPostEmbedding = await postEmbeddingRepository.save(post.id, EMBEDDING_MODEL, postVector);
    const foundPostEmbedding = await postEmbeddingRepository.findByPostId(post.id, EMBEDDING_MODEL);

    assert.equal(savedPostEmbedding.postId, post.id);
    assert.equal(savedPostEmbedding.embeddingModel, EMBEDDING_MODEL);
    assert.equal(foundPostEmbedding?.postId, post.id);
    assert.equal(foundPostEmbedding?.embeddingModel, EMBEDDING_MODEL);
    assert.equal(foundPostEmbedding?.embedding.length, 1536);
    assert.ok(Math.abs(foundPostEmbedding.embedding[0] - postVector[0]) < tolerance);
    assert.ok(Math.abs(foundPostEmbedding.embedding[1024] - postVector[1024]) < tolerance);
    assert.equal(await postEmbeddingRepository.findByPostId(randomUUID(), EMBEDDING_MODEL), null);
    await assert.rejects(
      postEmbeddingRepository.save(post.id, EMBEDDING_MODEL, [0.1]),
      /exactly 1536 values/,
    );
    await assert.rejects(
      postEmbeddingRepository.save(post.id, EMBEDDING_MODEL, [...postVector.slice(0, 1535), Infinity]),
      /finite numbers/,
    );
  } finally {
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
