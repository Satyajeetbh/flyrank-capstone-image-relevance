import { OPENAI_EMBEDDING_MODEL } from "../providers/openai-embeddings.js";
import { evaluateMismatchGuard } from "../domain/mismatch-guard.js";
import type { MatchingCandidateResult, MatchingResult } from "../domain/matching-result.js";
import {
  imageEmbeddingRepository,
  type ImageEmbeddingRepository,
  type SemanticImageCandidate,
} from "../repositories/image-embeddings.js";
import { postEmbeddingRepository, type PostEmbeddingRepository } from "../repositories/post-embeddings.js";
import { postRepository, type PostRepository } from "../repositories/posts.js";

export const DEFAULT_SEMANTIC_RETRIEVAL_LIMIT = 5;

export type SemanticRetrievalErrorKind = "post_not_found" | "post_embedding_not_found";

export class SemanticRetrievalError extends Error {
  public constructor(
    message: string,
    public readonly kind: SemanticRetrievalErrorKind,
  ) {
    super(message);
    this.name = "SemanticRetrievalError";
  }
}

export interface SemanticImageRetrievalResult {
  postId: string;
  candidates: SemanticImageCandidate[];
}

export class SemanticImageRetrievalService {
  public constructor(
    private readonly posts: PostRepository = postRepository,
    private readonly postEmbeddings: PostEmbeddingRepository = postEmbeddingRepository,
    private readonly imageEmbeddings: ImageEmbeddingRepository = imageEmbeddingRepository,
  ) {}

  public async retrieve(
    postId: string,
    limit = DEFAULT_SEMANTIC_RETRIEVAL_LIMIT,
  ): Promise<SemanticImageRetrievalResult> {
    const post = await this.posts.findById(postId);
    if (!post) {
      throw new SemanticRetrievalError("Post was not found.", "post_not_found");
    }

    const postEmbedding = await this.postEmbeddings.findByPostId(post.id, OPENAI_EMBEDDING_MODEL);
    if (!postEmbedding) {
      throw new SemanticRetrievalError("Post embedding was not found.", "post_embedding_not_found");
    }

    return {
      postId: post.id,
      candidates: await this.imageEmbeddings.findSimilar(
        postEmbedding.embedding,
        OPENAI_EMBEDDING_MODEL,
        limit,
      ),
    };
  }

  public async match(
    postId: string,
    limit = DEFAULT_SEMANTIC_RETRIEVAL_LIMIT,
  ): Promise<MatchingResult> {
    const post = await this.posts.findById(postId);
    if (!post) {
      throw new SemanticRetrievalError("Post was not found.", "post_not_found");
    }

    const retrieved = await this.retrieve(post.id, limit);
    const evaluatedCandidates: MatchingCandidateResult[] = retrieved.candidates.map((candidate) => {
      const guardResult = evaluateMismatchGuard({
        expectedSubject: post.expectedSubject,
        expectedCategory: post.expectedCategory,
        candidateSubject: candidate.subject,
        candidateCategory: candidate.category,
        visionConfidence: candidate.visionConfidence,
        semanticSimilarity: candidate.similarity,
      });

      return {
        imageId: candidate.imageId,
        similarity: candidate.similarity,
        guardDecision: guardResult.decision,
        reasonCode: guardResult.reasonCode,
        reason: guardResult.reason,
      };
    });

    const recommendation = evaluatedCandidates.find(
      (candidate) => candidate.guardDecision === "ACCEPT",
    ) ?? null;

    return {
      postId: post.id,
      decision: recommendation ? "ACCEPT" : "NO_CONFIDENT_MATCH",
      recommendation,
      alternatives: recommendation
        ? evaluatedCandidates.filter((candidate) => candidate !== recommendation)
        : evaluatedCandidates,
    };
  }
}
