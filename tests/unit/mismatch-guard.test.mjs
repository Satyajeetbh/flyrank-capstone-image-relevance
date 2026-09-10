import assert from "node:assert/strict";
import test from "node:test";

import { GUARD_THRESHOLDS } from "../../dist/domain/guard-policy.js";
import { evaluateMismatchGuard } from "../../dist/domain/mismatch-guard.js";

function matchingInput(overrides = {}) {
  return {
    expectedSubject: "mountain bike",
    expectedCategory: "sports",
    candidateSubject: "mountain bike",
    candidateCategory: "sports",
    visionConfidence: 0.9,
    semanticSimilarity: 0.9,
    ...overrides,
  };
}

test("accepts a high-confidence matching candidate", () => {
  assert.deepEqual(evaluateMismatchGuard(matchingInput()), {
    decision: "ACCEPT",
    reasonCode: null,
    reason: "Candidate similarity, metadata, and vision confidence meet the guard policy.",
  });
});

test("rejects a candidate with low similarity", () => {
  const result = evaluateMismatchGuard(matchingInput({ semanticSimilarity: 0.4 }));

  assert.equal(result.decision, "REJECT");
  assert.equal(result.reasonCode, "SIMILARITY_TOO_LOW");
});

test("rejects a subject mismatch", () => {
  const result = evaluateMismatchGuard(matchingInput({ candidateSubject: "road bicycle" }));

  assert.equal(result.decision, "REJECT");
  assert.equal(result.reasonCode, "SUBJECT_MISMATCH");
});

test("rejects a category mismatch", () => {
  const result = evaluateMismatchGuard(matchingInput({ candidateCategory: "fashion" }));

  assert.equal(result.decision, "REJECT");
  assert.equal(result.reasonCode, "CATEGORY_MISMATCH");
});

test("sends low vision confidence to review", () => {
  const result = evaluateMismatchGuard(matchingInput({ visionConfidence: 0.5 }));

  assert.equal(result.decision, "REVIEW");
  assert.equal(result.reasonCode, "LOW_VISION_CONFIDENCE");
});

test("sends missing metadata to review", () => {
  const result = evaluateMismatchGuard(matchingInput({ candidateCategory: null }));

  assert.equal(result.decision, "REVIEW");
  assert.equal(result.reasonCode, "MISSING_METADATA");
});

test("accepts similarity exactly at the provisional threshold", () => {
  const result = evaluateMismatchGuard(
    matchingInput({ semanticSimilarity: GUARD_THRESHOLDS.minimumSemanticSimilarity }),
  );

  assert.equal(result.decision, "ACCEPT");
});

test("rejects similarity just below the provisional threshold", () => {
  const result = evaluateMismatchGuard(
    matchingInput({ semanticSimilarity: GUARD_THRESHOLDS.minimumSemanticSimilarity - 0.001 }),
  );

  assert.equal(result.decision, "REJECT");
  assert.equal(result.reasonCode, "SIMILARITY_TOO_LOW");
});

test("accepts confidence exactly at the provisional threshold", () => {
  const result = evaluateMismatchGuard(
    matchingInput({ visionConfidence: GUARD_THRESHOLDS.minimumVisionConfidence }),
  );

  assert.equal(result.decision, "ACCEPT");
});

test("sends confidence just below the provisional threshold to review", () => {
  const result = evaluateMismatchGuard(
    matchingInput({ visionConfidence: GUARD_THRESHOLDS.minimumVisionConfidence - 0.001 }),
  );

  assert.equal(result.decision, "REVIEW");
  assert.equal(result.reasonCode, "LOW_VISION_CONFIDENCE");
});

test("accepts labels that differ only by case and surrounding whitespace", () => {
  const result = evaluateMismatchGuard({
    expectedSubject: "Red Fox",
    expectedCategory: "Animal",
    candidateSubject: " red fox ",
    candidateCategory: " animal ",
    visionConfidence: 0.9,
    semanticSimilarity: 0.9,
  });

  assert.equal(result.decision, "ACCEPT");
  assert.equal(result.reasonCode, null);
});

test("accepts a subject when the expected subject is a token within a richer candidate description", () => {
  const result = evaluateMismatchGuard({
    expectedSubject: "mountain",
    expectedCategory: "landscapes",
    candidateSubject: "forested mountain range",
    candidateCategory: "landscapes",
    visionConfidence: 0.99,
    semanticSimilarity: 0.556,
  });

  assert.equal(result.decision, "ACCEPT");
  assert.equal(result.reasonCode, null);
});

test("rejects unrelated subjects even when they share no semantic label token", () => {
  const result = evaluateMismatchGuard({
    expectedSubject: "red fox",
    expectedCategory: "animals",
    candidateSubject: "gray wolf",
    candidateCategory: "animals",
    visionConfidence: 0.99,
    semanticSimilarity: 0.6,
  });

  assert.equal(result.decision, "REJECT");
  assert.equal(result.reasonCode, "SUBJECT_MISMATCH");
});