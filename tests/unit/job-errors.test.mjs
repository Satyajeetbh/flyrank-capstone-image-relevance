import assert from "node:assert/strict";
import test from "node:test";

import {
  ImageProcessingJobError,
  isRetryableJobError,
} from "../../dist/domain/job-errors.js";

test("retryable job error is classified as retryable", () => {
  const error = new ImageProcessingJobError(
    "OpenAI request timed out.",
    "retryable",
  );

  assert.equal(isRetryableJobError(error), true);
});

test("permanent job error is not classified as retryable", () => {
  const error = new ImageProcessingJobError(
    "Image metadata failed schema validation.",
    "permanent",
  );

  assert.equal(isRetryableJobError(error), false);
});

test("ordinary errors are not classified as retryable", () => {
  assert.equal(
    isRetryableJobError(new Error("Unexpected failure.")),
    false,
  );
});