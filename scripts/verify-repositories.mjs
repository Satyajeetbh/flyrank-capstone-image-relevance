import { randomUUID } from "node:crypto";

import { closeDatabasePool, pool } from "../dist/infrastructure/database.js";
import { imageRepository } from "../dist/repositories/images.js";
import { postRepository } from "../dist/repositories/posts.js";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const runId = randomUUID();
let imageId;
let postId;
let verificationFailed = false;

try {
  const image = await imageRepository.create({
    sourceUrl: `https://example.test/images/${runId}.jpg`,
    storageReference: `verification/${runId}.jpg`,
  });
  imageId = image.id;

  const retrievedImage = await imageRepository.findById(image.id);
  assert(retrievedImage?.id === image.id, "Image retrieval verification failed.");
  assert(retrievedImage.storageReference === image.storageReference, "Image mapping verification failed.");

  const updatedImage = await imageRepository.updateProcessingStatus(image.id, "completed");
  assert(updatedImage?.processingStatus === "completed", "Image status update verification failed.");

  const listedImages = await imageRepository.list();
  assert(listedImages.some((listedImage) => listedImage.id === image.id), "Image list verification failed.");

  const post = await postRepository.create({
    title: `Repository verification ${runId}`,
    content: "Repository integration verification content.",
    expectedSubject: "verification",
    expectedCategory: "integration",
  });
  postId = post.id;

  const retrievedPost = await postRepository.findById(post.id);
  assert(retrievedPost?.id === post.id, "Post retrieval verification failed.");
  assert(retrievedPost.expectedSubject === post.expectedSubject, "Post mapping verification failed.");

  const listedPosts = await postRepository.list();
  assert(listedPosts.some((listedPost) => listedPost.id === post.id), "Post list verification failed.");

  console.log("Repository integration verification passed.");
} catch {
  verificationFailed = true;
  console.error("Repository integration verification failed.");
} finally {
  try {
    if (postId) {
      await pool.query("DELETE FROM posts WHERE id = $1", [postId]);
    }
    if (imageId) {
      await pool.query("DELETE FROM images WHERE id = $1", [imageId]);
    }
  } catch {
    verificationFailed = true;
    console.error("Repository verification cleanup failed.");
  }

  try {
    await closeDatabasePool();
  } catch {
    verificationFailed = true;
    console.error("Database pool shutdown failed.");
  }
}

process.exitCode = verificationFailed ? 1 : 0;
