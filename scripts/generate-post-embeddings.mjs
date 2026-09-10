import { postRepository } from "../dist/repositories/posts.js";
import { postEmbeddingRepository } from "../dist/repositories/post-embeddings.js";
import { GeminiEmbeddingProvider } from "../dist/providers/gemini-embeddings.js";
import { getEmbeddingModel } from "../dist/providers/embedding-config.js";

const embeddingModel = getEmbeddingModel();

if (embeddingModel !== "gemini-embedding-2") {
  throw new Error(
    `Expected Gemini Embedding 2, but configured model is: ${embeddingModel}`,
  );
}

const embeddingProvider = new GeminiEmbeddingProvider();

const posts = await postRepository.list();

if (posts.length !== 10) {
  throw new Error(`Expected 10 evaluation posts, found ${posts.length}.`);
}

let generated = 0;
let skipped = 0;

for (const post of posts) {
  const existing = await postEmbeddingRepository.findByPostId(
    post.id,
    embeddingModel,
  );

  if (existing) {
    console.log(
      `Skipped ${post.id}: ${embeddingModel} embedding already exists.`,
    );
    skipped += 1;
    continue;
  }

  const result = await embeddingProvider.embedPost({
    title: post.title,
    content: post.content,
  });

  await postEmbeddingRepository.save(
    post.id,
    embeddingModel,
    result.output,
  );

  console.log(`Generated ${embeddingModel} embedding for ${post.id}.`);
  generated += 1;
}

console.log(
  `Post embedding generation complete. Generated: ${generated}, skipped: ${skipped}.`,
);