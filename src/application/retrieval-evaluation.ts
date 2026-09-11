import { z } from "zod";
import type { MatchingDecision } from "../domain/matching-result.js";
import type { GuardDecision } from "../domain/mismatch-guard.js";

const labeledPostSchema = z.object({
  postId: z.string().uuid(),
  expectedCorpusImageId: z.string().trim().min(1),
});

const labeledPostsSchema = z.array(labeledPostSchema).min(1);

export interface LabeledPost {
  postId: string;
  expectedCorpusImageId: string;
}

export function parseLabeledPosts(input: unknown): LabeledPost[] {
  return labeledPostsSchema.parse(input);
}

export interface EvaluatedRetrievalRecord {
  expectedImageId: string;
  baselineImageId: string | null;
  baselineRetrievedImageIds: string[];
  guardedDecision: MatchingDecision;
  guardedImageId: string | null;
  guardedCandidates: Array<{
    imageId: string;
    guardDecision: GuardDecision;
  }>;
}

export interface RetrievalEvaluationMetrics {
  totalEvaluatedPosts: number;
  baselineCorrect: number;
  baselineIncorrect: number;
  guardedCorrect: number;
  guardedIncorrect: number;
  noConfidentMatchCount: number;
  acceptedIncorrectMatches: number;
  expectedRetrievedButRejectedCount: number;
}

export function calculateRetrievalMetrics(
  records: EvaluatedRetrievalRecord[],
): RetrievalEvaluationMetrics {
  const baselineCorrect = records.filter(
    (record) => record.baselineImageId === record.expectedImageId,
  ).length;

  const guardedCorrect = records.filter(
    (record) => record.guardedImageId === record.expectedImageId,
  ).length;

  const expectedRetrievedButRejectedCount = records.filter((record) => {
    if (!record.baselineRetrievedImageIds.includes(record.expectedImageId)) {
      return false;
    }

    const expectedCandidate = record.guardedCandidates.find(
      (candidate) => candidate.imageId === record.expectedImageId,
    );

    return expectedCandidate?.guardDecision !== "ACCEPT";
  }).length;

  return {
    totalEvaluatedPosts: records.length,
    baselineCorrect,
    baselineIncorrect: records.length - baselineCorrect,
    guardedCorrect,
    guardedIncorrect: records.length - guardedCorrect,
    noConfidentMatchCount: records.filter(
      (record) => record.guardedDecision === "NO_CONFIDENT_MATCH",
    ).length,
    acceptedIncorrectMatches: records.filter(
      (record) =>
        record.guardedDecision === "ACCEPT" &&
        record.guardedImageId !== record.expectedImageId,
    ).length,
    expectedRetrievedButRejectedCount,
  };
}