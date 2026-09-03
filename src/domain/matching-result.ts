import type { GuardDecision, GuardReasonCode } from "./mismatch-guard.js";

export type MatchingDecision = GuardDecision | "NO_CONFIDENT_MATCH";

export interface MatchingResult {
  decision: MatchingDecision;
  postId: string;
  imageId: string | null;
  similarityScore: number | null;
  reasonCode: GuardReasonCode | null;
  reason: string;
}
