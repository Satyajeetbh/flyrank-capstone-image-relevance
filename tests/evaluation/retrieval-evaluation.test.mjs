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
    expectedImageId: label.expectedCorpusImageId,
    baselineImageId: index === 0 ? "00000000-0000-4000-8000-000000000000" : label.expectedCorpusImageId,
    baselineRetrievedImageIds: [label.expectedCorpusImageId],
    guardedDecision: index === 2 ? "NO_CONFIDENT_MATCH" : "ACCEPT",
    guardedImageId: index === 0 || index === 2 ? null : label.expectedCorpusImageId,
    guardedCandidates: [
      {
        imageId: label.expectedCorpusImageId,
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

test("records a no-confident-match outcome when the baseline candidate is incorrect and the guard rejects it", () => {
  const expectedImageId = "11111111-1111-4111-8111-111111111111";
  const incorrectImageId = "22222222-2222-4222-8222-222222222222";

  const metrics = calculateRetrievalMetrics([
    {
      expectedImageId,
      baselineImageId: incorrectImageId,
      baselineRetrievedImageIds: [incorrectImageId],
      guardedDecision: "NO_CONFIDENT_MATCH",
      guardedImageId: null,
      guardedCandidates: [
        {
          imageId: incorrectImageId,
          guardDecision: "REJECT",
        },
      ],
    },
  ]);

  assert.equal(metrics.baselineIncorrect, 1);
  assert.equal(metrics.guardedCorrect, 0);
  assert.equal(metrics.guardedIncorrect, 1);
  assert.equal(metrics.noConfidentMatchCount, 1);
  assert.equal(metrics.acceptedIncorrectMatches, 0);
});