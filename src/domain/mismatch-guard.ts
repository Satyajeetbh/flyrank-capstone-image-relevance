import { GUARD_THRESHOLDS } from "./guard-policy.js";

export type GuardDecision = "ACCEPT" | "REJECT" | "REVIEW";

export type GuardReasonCode =
  | "SIMILARITY_TOO_LOW"
  | "SUBJECT_MISMATCH"
  | "CATEGORY_MISMATCH"
  | "LOW_VISION_CONFIDENCE"
  | "MISSING_METADATA"
  | "NO_USABLE_CANDIDATE";

export interface MismatchGuardInput {
  expectedSubject: string | null;
  expectedCategory: string | null;
  candidateSubject: string | null;
  candidateCategory: string | null;
  visionConfidence: number | null;
  semanticSimilarity: number | null;
}

export interface MismatchGuardResult {
  decision: GuardDecision;
  reasonCode: GuardReasonCode | null;
  reason: string;
}

function isMissing(value: string | null): boolean {
  return value === null || value.trim().length === 0;
}

function normalizeLabel(value: string | null): string {
  return value?.trim().toLowerCase() ?? "";
}

export function evaluateMismatchGuard(input: MismatchGuardInput): MismatchGuardResult {
  if (input.semanticSimilarity === null) {
    return {
      decision: "REJECT",
      reasonCode: "NO_USABLE_CANDIDATE",
      reason: "No candidate has a usable semantic similarity score.",
    };
  }

  if (
    isMissing(input.expectedSubject) ||
    isMissing(input.expectedCategory) ||
    isMissing(input.candidateSubject) ||
    isMissing(input.candidateCategory) ||
    input.visionConfidence === null
  ) {
    return {
      decision: "REVIEW",
      reasonCode: "MISSING_METADATA",
      reason: "Required post or image metadata is missing.",
    };
  }

  if (input.semanticSimilarity < GUARD_THRESHOLDS.minimumSemanticSimilarity) {
    return {
      decision: "REJECT",
      reasonCode: "SIMILARITY_TOO_LOW",
      reason: `Semantic similarity is below ${GUARD_THRESHOLDS.minimumSemanticSimilarity}.`,
    };
  }

  if (normalizeLabel(input.expectedSubject) !== normalizeLabel(input.candidateSubject)) {
    return {
      decision: "REJECT",
      reasonCode: "SUBJECT_MISMATCH",
      reason: "The candidate image subject does not match the post subject.",
    };
  }

  if (normalizeLabel(input.expectedCategory) !== normalizeLabel(input.candidateCategory)) {
    return {
      decision: "REJECT",
      reasonCode: "CATEGORY_MISMATCH",
      reason: "The candidate image category does not match the post category.",
    };
  }

  if (input.visionConfidence < GUARD_THRESHOLDS.minimumVisionConfidence) {
    return {
      decision: "REVIEW",
      reasonCode: "LOW_VISION_CONFIDENCE",
      reason: `Vision confidence is below ${GUARD_THRESHOLDS.minimumVisionConfidence}.`,
    };
  }

  return {
    decision: "ACCEPT",
    reasonCode: null,
    reason: "Candidate similarity, metadata, and vision confidence meet the guard policy.",
  };
}
