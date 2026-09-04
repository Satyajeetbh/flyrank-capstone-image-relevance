import { readFile } from "node:fs/promises";

const labelsUrl = new URL("../data/evaluation/labeled-posts.json", import.meta.url);

let closeDatabasePool;
let failed = false;

try {
  const labels = JSON.parse(await readFile(labelsUrl, "utf8"));
  const evaluation = await import("../dist/application/retrieval-evaluation.js");
  const database = await import("../dist/infrastructure/database.js");
  const { OpenAIEmbeddingProvider, OPENAI_EMBEDDING_MODEL } = await import("../dist/providers/openai-embeddings.js");
  const { imageRepository } = await import("../dist/repositories/images.js");
  const { postRepository } = await import("../dist/repositories/posts.js");
  const { imageEmbeddingRepository } = await import("../dist/repositories/image-embeddings.js");
  const { postEmbeddingRepository } = await import("../dist/repositories/post-embeddings.js");

  closeDatabasePool = database.closeDatabasePool;
  const pool = database.pool;
  const labeledPosts = evaluation.parseLabeledPosts(labels);
  const provider = new OpenAIEmbeddingProvider();
  const generated = [];

  for (const labeledPost of labeledPosts) {
    const post = await postRepository.findById(labeledPost.postId);
    const image = await imageRepository.findById(labeledPost.expectedImageId);
    if (!post || !image) {
      throw new Error("Evaluation fixture is missing a labeled post or image.");
    }

    const metadataResult = await pool.query(
      `
        SELECT subject, category, attributes, caption, vision_confidence
        FROM image_metadata
        WHERE image_id = $1
      `,
      [image.id],
    );
    const metadataRow = metadataResult.rows[0];
    if (!metadataRow || !Array.isArray(metadataRow.attributes)) {
      throw new Error("Evaluation fixture is missing valid image metadata.");
    }

    const metadata = {
      subject: metadataRow.subject,
      category: metadataRow.category,
      attributes: metadataRow.attributes,
      caption: metadataRow.caption,
      confidence: Number(metadataRow.vision_confidence),
    };
    const postEmbedding = await provider.embedPost({ title: post.title, content: post.content });
    const imageEmbedding = await provider.embedImageMetadata(metadata);

    generated.push({
      postId: post.id,
      imageId: image.id,
      postEmbedding,
      imageEmbedding,
    });
  }

  const postIds = generated.map((record) => record.postId);
  const imageIds = generated.map((record) => record.imageId);
  await pool.query("DELETE FROM post_embeddings WHERE post_id = ANY($1::uuid[])", [postIds]);
  await pool.query("DELETE FROM image_embeddings WHERE image_id = ANY($1::uuid[])", [imageIds]);

  for (const record of generated) {
    await postEmbeddingRepository.save(record.postId, OPENAI_EMBEDDING_MODEL, record.postEmbedding);
    await imageEmbeddingRepository.save(record.imageId, OPENAI_EMBEDDING_MODEL, record.imageEmbedding);
  }

  console.log(`Generated and persisted ${generated.length} post embeddings and ${generated.length} image embeddings.`);
} catch {
  failed = true;
  console.error("Evaluation corpus generation failed. Verify PostgreSQL and OPENAI_API_KEY configuration.");
} finally {
  if (closeDatabasePool) {
    try {
      await closeDatabasePool();
    } catch {
      failed = true;
      console.error("Evaluation corpus database pool shutdown failed.");
    }
  }
}

process.exitCode = failed ? 1 : 0;
