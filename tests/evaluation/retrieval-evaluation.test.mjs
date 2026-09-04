import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  calculateRetrievalMetrics,
  parseLabeledPosts,
} from "../../dist/application/retrieval-evaluation.js";

const labelsUrl = new URL("../../data/evaluation/labeled-posts.json", import.meta.url);

test("loads the labeled evaluation set and derives retrieval metrics", async () => {
  const labels = parseLabeledPosts(JSON.parse(await readFile(labelsUrl, "utf8")));
  assert.equal(labels.length, 10);

  const records = labels.slice(0, 3).map((label, index) => ({
    expectedImageId: label.expectedImageId,
    baselineImageId: index === 0 ? "00000000-0000-4000-8000-000000000000" : label.expectedImageId,
    baselineRetrievedImageIds: [label.expectedImageId],
    guardedDecision: index === 2 ? "NO_CONFIDENT_MATCH" : "ACCEPT",
    guardedImageId: index === 0 || index === 2 ? null : label.expectedImageId,
    guardedCandidates: [
      {
        imageId: label.expectedImageId,
        guardDecision: index === 2 ? "REJECT" : "ACCEPT",
      },
    ],
  }));

  const metrics = calculateRetrievalMetrics(records);
  assert.equal(metrics.totalEvaluatedPosts, records.length);
  assert.equal(metrics.baselineCorrect, records.filter((record) => record.baselineImageId === record.expectedImageId).length);
  assert.equal(metrics.baselineIncorrect, 1);
  assert.equal(metrics.guardedCorrect, 1);
  assert.equal(metrics.guardedIncorrect, 2);
  assert.equal(metrics.noConfidentMatchCount, 1);
  assert.equal(metrics.acceptedIncorrectMatches, 1);
  assert.equal(metrics.expectedRetrievedButRejectedCount, 1);
});
