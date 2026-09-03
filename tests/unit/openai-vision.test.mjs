import assert from "node:assert/strict";
import test from "node:test";

import { OpenAIVisionError, parseImageMetadata } from "../../dist/providers/openai-vision.js";

function validOutput(overrides = {}) {
  return {
    subject: "red fox",
    category: "animal",
    attributes: ["fur", "outdoors"],
    caption: "A red fox standing outdoors.",
    confidence: 0.92,
    ...overrides,
  };
}

function assertInvalidOutput(output) {
  assert.throws(
    () => parseImageMetadata(output),
    (error) => error instanceof OpenAIVisionError && error.kind === "invalid_model_output",
  );
}

test("converts valid structured output to ImageMetadata", () => {
  assert.deepEqual(parseImageMetadata(validOutput()), validOutput());
});

test("rejects an empty subject", () => {
  assertInvalidOutput(validOutput({ subject: " " }));
});

test("rejects an empty category", () => {
  assertInvalidOutput(validOutput({ category: "" }));
});

test("rejects an empty caption", () => {
  assertInvalidOutput(validOutput({ caption: "" }));
});

test("rejects non-string attributes", () => {
  assertInvalidOutput(validOutput({ attributes: ["fur", 12] }));
});

test("rejects confidence below zero", () => {
  assertInvalidOutput(validOutput({ confidence: -0.01 }));
});

test("rejects confidence above one", () => {
  assertInvalidOutput(validOutput({ confidence: 1.01 }));
});

test("preserves valid low-confidence output as metadata", () => {
  const metadata = parseImageMetadata(validOutput({ confidence: 0.2 }));

  assert.equal(metadata.confidence, 0.2);
});
