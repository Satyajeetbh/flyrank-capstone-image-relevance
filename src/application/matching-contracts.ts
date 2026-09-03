export interface MatchPostInput {
  postId: string;
  expectedSubject: string;
  expectedCategory: string;
}

export interface CandidateImageInput {
  imageId: string;
  subject: string | null;
  category: string | null;
  visionConfidence: number | null;
  semanticSimilarity: number | null;
}

/**
 * Minimal boundary object for a later post-to-candidate orchestration flow.
 * Retrieval, embedding, and guard execution are intentionally not implemented here.
 */
export interface MatchCandidateContext {
  post: MatchPostInput;
  candidate: CandidateImageInput;
}
