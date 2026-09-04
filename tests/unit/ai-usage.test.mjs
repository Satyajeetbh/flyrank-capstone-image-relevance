import assert from "node:assert/strict";
import test from "node:test";

import {
  AI_USAGE_PRICING,
  calculateEstimatedCost,
} from "../../dist/application/ai-cost.js";

const embeddingUsage = {
  provider: "openai",
  model: "text-embedding-3-small",
  inputUnits: 1_000_000,
  outputUnits: 0,
};

test("calculates cost with explicitly supplied pricing", () => {
  assert.equal(
    calculateEstimatedCost(embeddingUsage, {
      inputCostPerMillion: 0.02,
      outputCostPerMillion: 0.04,
    }),
    0.02,
  );
});

test("calculates configured gpt-4.1-mini cost", () => {
  assert.ok(
    Math.abs(
      calculateEstimatedCost({
        provider: "openai",
        model: "gpt-4.1-mini",
        inputUnits: 1_000,
        outputUnits: 500,
      }) - 0.0012,
    ) < Number.EPSILON,
  );
});

test("calculates configured text-embedding-3-small cost", () => {
  assert.equal(
    calculateEstimatedCost({
      provider: "openai",
      model: "text-embedding-3-small",
      inputUnits: 1_000,
      outputUnits: 0,
    }),
    0.00002,
  );
});

test("returns no cost when the requested model has no configured pricing", () => {
  assert.equal(
    calculateEstimatedCost({
      provider: "openai",
      model: "unknown-model",
      inputUnits: 1_000,
      outputUnits: 500,
    }),
    null,
  );
});
