/**
 * Provisional thresholds for the deterministic guard.
 * They must be tuned against the labeled evaluation set in a later stage.
 */
export const GUARD_THRESHOLDS = {
  minimumSemanticSimilarity: 0.75,
  minimumVisionConfidence: 0.7,
} as const;
