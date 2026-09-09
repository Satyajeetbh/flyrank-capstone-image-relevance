import assert from "node:assert/strict";
import test from "node:test";

import {
  OPENAI_EMBEDDING_DIMENSIONS,
  OPENAI_EMBEDDING_MODEL,
  OpenAIEmbeddingError,
  OpenAIEmbeddingProvider,
  parseEmbeddingResponse,
  parseEmbeddingUsage,
} from "../../dist/providers/openai-embeddings.js";

import {
  imageMetadataToEmbeddingText,
  postToEmbeddingText,
} from "../../dist/providers/embedding.js";

function validMetadata() {
  return {
    subject: "red fox",
    category: "animal",
    attributes: ["fur", "outdoors"],
    caption: "A red fox standing outdoors.",
    confidence: 0.92,
  };
}

function validResponse() {
  return { data: [{ embedding: Array.from({ length: OPENAI_EMBEDDING_DIMENSIONS }, () => 0.1) }] };
}

function assertInvalidEmbedding(response) {
  assert.throws(
    () => parseEmbeddingResponse(response),
    (error) => error instanceof OpenAIEmbeddingError && error.kind === "invalid_embedding_output",
  );
}

test("creates the canonical image metadata representation", () => {
  assert.equal(
    imageMetadataToEmbeddingText(validMetadata()),
    "Subject: red fox\nCategory: animal\nAttributes: fur, outdoors\nCaption: A red fox standing outdoors.",
  );
});

test("creates the canonical post representation", () => {
  assert.equal(
    postToEmbeddingText({ title: "Fox habitat", content: "A short description." }),
    "Title: Fox habitat\nContent: A short description.",
  );
});

test("produces deterministic representations", () => {
  const metadata = validMetadata();

  assert.equal(imageMetadataToEmbeddingText(metadata), imageMetadataToEmbeddingText(metadata));
  assert.equal(
    postToEmbeddingText({ title: "Title", content: "Content" }),
    postToEmbeddingText({ title: "Title", content: "Content" }),
  );
});

test("parses an embedding with the fixed dimension", () => {
  const embedding = parseEmbeddingResponse(validResponse());

  assert.equal(embedding.length, OPENAI_EMBEDDING_DIMENSIONS);
  assert.equal(embedding[0], 0.1);
});

test("rejects an embedding with the wrong dimension", () => {
  assertInvalidEmbedding({ data: [{ embedding: [0.1, 0.2] }] });
});

test("rejects non-numeric embedding values", () => {
  const response = { data: [{ embedding: ["not-a-number", ...Array(OPENAI_EMBEDDING_DIMENSIONS - 1).fill(0.1)] }] };

  assertInvalidEmbedding(response);
});

test("rejects non-finite embedding values", () => {
  const values = Array.from({ length: OPENAI_EMBEDDING_DIMENSIONS }, () => 0.1);
  values[0] = Number.NaN;

  assertInvalidEmbedding({ data: [{ embedding: values }] });
});

test("classifies missing API configuration as a provider failure", () => {
  const originalApiKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;

  try {
    assert.throws(
      () => new OpenAIEmbeddingProvider(),
      (error) => error instanceof OpenAIEmbeddingError && error.kind === "provider_api_failure",
    );
  } finally {
    if (originalApiKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = originalApiKey;
    }
  }
});

test("uses the fixed text embedding model", () => {
  assert.equal(OPENAI_EMBEDDING_MODEL, "text-embedding-3-small");
  assert.equal(OPENAI_EMBEDDING_DIMENSIONS, 1536);
});

test("maps embedding prompt usage to provider-neutral usage", () => {
  assert.deepEqual(parseEmbeddingUsage({ prompt_tokens: 42, total_tokens: 42 }), {
    provider: "openai",
    model: "text-embedding-3-small",
    inputUnits: 42,
    outputUnits: 0,
  });
});
