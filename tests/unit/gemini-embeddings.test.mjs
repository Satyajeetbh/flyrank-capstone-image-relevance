import assert from "node:assert/strict";
import test from "node:test";

import {
  GEMINI_EMBEDDING_DIMENSIONS,
  GEMINI_EMBEDDING_MODEL,
  GeminiEmbeddingError,
  parseEmbeddingVector,
  GeminiEmbeddingProvider,
} from "../../dist/providers/gemini-embeddings.js";

function validEmbedding() {
  return Array.from(
    { length: GEMINI_EMBEDDING_DIMENSIONS },
    () => 0.1,
  );
}

function assertInvalidEmbedding(value) {
  assert.throws(
    () => parseEmbeddingVector(value),
    (error) =>
      error instanceof GeminiEmbeddingError &&
      error.kind === "invalid_embedding_output",
  );
}

test("uses Gemini Embedding 2 with the database-compatible dimension", () => {
  assert.equal(GEMINI_EMBEDDING_MODEL, "gemini-embedding-2");
  assert.equal(GEMINI_EMBEDDING_DIMENSIONS, 1536);
});

test("parses a valid 1536-dimensional embedding", () => {
  const embedding = parseEmbeddingVector(validEmbedding());

  assert.equal(embedding.length, GEMINI_EMBEDDING_DIMENSIONS);
  assert.equal(embedding[0], 0.1);
});

test("rejects an embedding with the wrong dimension", () => {
  assertInvalidEmbedding([0.1, 0.2]);
});

test("rejects non-numeric embedding values", () => {
  const values = validEmbedding();
  values[0] = "not-a-number";

  assertInvalidEmbedding(values);
});

test("rejects non-finite embedding values", () => {
  const values = validEmbedding();
  values[0] = Number.NaN;

  assertInvalidEmbedding(values);
});

test("rejects a missing embedding vector", () => {
  assertInvalidEmbedding(undefined);
});

test("classifies missing Gemini API configuration as a provider failure", () => {
  const originalApiKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;

  try {
    assert.throws(
      () => new GeminiEmbeddingProvider(),
      (error) =>
        error instanceof GeminiEmbeddingError &&
        error.kind === "provider_api_failure",
    );
  } finally {
    if (originalApiKey === undefined) {
      delete process.env.GEMINI_API_KEY;
    } else {
      process.env.GEMINI_API_KEY = originalApiKey;
    }
  }
});

