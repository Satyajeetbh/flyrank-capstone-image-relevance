/**
 * Production thresholds for the deterministic guard.
 * Semantic similarity was calibrated against the current 10-post labeled set;
 * it is empirical for this corpus and not universally optimal.
 */
export const GUARD_THRESHOLDS = {
  minimumSemanticSimilarity: 0.50,
  minimumVisionConfidence: 0.7,
} as const;
