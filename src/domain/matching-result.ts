import type { GuardDecision, GuardReasonCode } from "./mismatch-guard.js";

export type MatchingDecision = GuardDecision | "NO_CONFIDENT_MATCH";

export interface MatchingCandidateResult {
  imageId: string;
  similarity: number;
  guardDecision: GuardDecision;
  reasonCode: GuardReasonCode | null;
  reason: string;
}

export interface MatchingResult {
  decision: MatchingDecision;
  postId: string;
  recommendation: MatchingCandidateResult | null;
  alternatives: MatchingCandidateResult[];
}
