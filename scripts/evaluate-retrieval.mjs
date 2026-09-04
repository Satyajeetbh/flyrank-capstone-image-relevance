import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";

const labelsUrl = new URL("../data/evaluation/labeled-posts.json", import.meta.url);
const calibrationThresholds = [
  0.660,
  0.661,
  0.662,
  0.663,
  0.664,
  0.665,
  0.666,
  0.667,
  0.668,
  0.669,
  0.670,
];
const isCalibrationRun = process.argv.includes("--calibrate");

let closeDatabasePool;
let failed = false;

try {
  const labels = JSON.parse(await readFile(labelsUrl, "utf8"));
  const evaluation = await import("../dist/application/retrieval-evaluation.js");
  const { SemanticImageRetrievalService } = await import("../dist/application/semantic-image-retrieval.js");
  const { evaluateMismatchGuard } = await import("../dist/domain/mismatch-guard.js");
  const { GUARD_THRESHOLDS } = await import("../dist/domain/guard-policy.js");
  const { postRepository } = await import("../dist/repositories/posts.js");
  const database = await import("../dist/infrastructure/database.js");
  closeDatabasePool = database.closeDatabasePool;

  const labeledPosts = evaluation.parseLabeledPosts(labels);
  const evaluationSuggestionRepository = {
    async create() {
      return { id: `evaluation-${randomUUID()}` };
    },
  };
  const service = new SemanticImageRetrievalService(
    undefined,
    undefined,
    undefined,
    evaluationSuggestionRepository,
  );
  const records = [];
  const diagnostics = [];

  for (const labeledPost of labeledPosts) {
    const baseline = await service.retrieve(labeledPost.postId);
    const guarded = await service.match(labeledPost.postId);
    const guardedCandidates = [
      ...(guarded.recommendation ? [guarded.recommendation] : []),
      ...guarded.alternatives,
    ];
    const baselineTop = baseline.candidates[0] ?? null;
    const expectedCandidate = guardedCandidates.find(
      (candidate) => candidate.imageId === labeledPost.expectedImageId,
    ) ?? null;

    diagnostics.push({
      postId: labeledPost.postId,
      expectedImageId: labeledPost.expectedImageId,
      baselineTop1ImageId: baselineTop?.imageId ?? null,
      baselineTop1Similarity: baselineTop?.similarity ?? null,
      guardedDecision: guarded.decision,
      guardedRecommendationImageId: guarded.recommendation?.imageId ?? null,
      guardedRecommendationSimilarity: guarded.recommendation?.similarity ?? null,
      expectedImageSimilarity: expectedCandidate?.similarity ?? null,
      expectedImageGuardDecision: expectedCandidate?.guardDecision ?? null,
      expectedImageGuardReasonCode: expectedCandidate?.reasonCode ?? null,
      expectedImageGuardReason: expectedCandidate?.reason ?? null,
    });

    records.push({
      expectedImageId: labeledPost.expectedImageId,
      baselineImageId: baseline.candidates[0]?.imageId ?? null,
      baselineRetrievedImageIds: baseline.candidates.map((candidate) => candidate.imageId),
      guardedDecision: guarded.decision,
      guardedImageId: guarded.recommendation?.imageId ?? null,
      guardedCandidates: guardedCandidates.map((candidate) => ({
        imageId: candidate.imageId,
        guardDecision: candidate.guardDecision,
      })),
    });
  }

  const metrics = evaluation.calculateRetrievalMetrics(records);
  if (isCalibrationRun) {
    const calibrationResults = [];

    for (const threshold of calibrationThresholds) {
      let totalEvaluatedPosts = 0;
      let correctAcceptedMatches = 0;
      let incorrectAcceptedMatches = 0;
      let expectedImagesRejectedBecauseOfSimilarityThreshold = 0;
      let noConfidentMatchCount = 0;
      let acceptedCount = 0;

      for (const labeledPost of labeledPosts) {
        const post = await postRepository.findById(labeledPost.postId);
        if (!post) {
          throw new Error("Evaluation fixture is missing a labeled post.");
        }

        const retrieval = await service.retrieve(post.id);
        const evaluatedCandidates = retrieval.candidates.map((candidate) => {
          const guardSimilarity = candidate.similarity < threshold
            ? candidate.similarity
            : Math.max(candidate.similarity, GUARD_THRESHOLDS.minimumSemanticSimilarity);
          const guardResult = evaluateMismatchGuard({
            expectedSubject: post.expectedSubject,
            expectedCategory: post.expectedCategory,
            candidateSubject: candidate.subject,
            candidateCategory: candidate.category,
            visionConfidence: candidate.visionConfidence,
            semanticSimilarity: guardSimilarity,
          });

          return {
            imageId: candidate.imageId,
            similarity: candidate.similarity,
            guardDecision: guardResult.decision,
          };
        });
        const recommendation = evaluatedCandidates.find(
          (candidate) => candidate.guardDecision === "ACCEPT",
        ) ?? null;
        const expectedCandidate = evaluatedCandidates.find(
          (candidate) => candidate.imageId === labeledPost.expectedImageId,
        ) ?? null;

        totalEvaluatedPosts += 1;
        if (recommendation) {
          acceptedCount += 1;
          if (recommendation.imageId === labeledPost.expectedImageId) {
            correctAcceptedMatches += 1;
          } else {
            incorrectAcceptedMatches += 1;
          }
        } else {
          noConfidentMatchCount += 1;
        }
        if (expectedCandidate && expectedCandidate.similarity < threshold) {
          expectedImagesRejectedBecauseOfSimilarityThreshold += 1;
        }
      }

      calibrationResults.push({
        threshold,
        totalEvaluatedPosts,
        correctAcceptedMatches,
        incorrectAcceptedMatches,
        expectedImagesRejectedBecauseOfSimilarityThreshold,
        noConfidentMatchCount,
        guardedCorrectness: totalEvaluatedPosts === 0
          ? null
          : correctAcceptedMatches / totalEvaluatedPosts,
        guardedPrecision: acceptedCount === 0
          ? null
          : correctAcceptedMatches / acceptedCount,
      });
    }

    console.log("Retrieval threshold calibration");
    console.log(JSON.stringify(calibrationResults, null, 2));
  } else {
    console.log("Retrieval evaluation diagnostics");
    console.log(JSON.stringify(diagnostics, null, 2));
    console.log("Retrieval evaluation summary");
    console.log(JSON.stringify(metrics, null, 2));
  }
} catch {
  failed = true;
  console.error("Retrieval evaluation failed.");
} finally {
  if (closeDatabasePool) {
    try {
      await closeDatabasePool();
    } catch {
      failed = true;
      console.error("Evaluation database pool shutdown failed.");
    }
  }
}

process.exitCode = failed ? 1 : 0;
