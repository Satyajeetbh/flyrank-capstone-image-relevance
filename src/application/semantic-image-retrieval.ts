import { getEmbeddingModel } from "../providers/embedding-config.js";
import { evaluateMismatchGuard } from "../domain/mismatch-guard.js";
import type { GuardDecision } from "../domain/mismatch-guard.js";
import type { MatchingCandidateResult, MatchingResult } from "../domain/matching-result.js";
import {
  imageEmbeddingRepository,
  type ImageEmbeddingRepository,
  type SemanticImageCandidate,
} from "../repositories/image-embeddings.js";
import { postEmbeddingRepository, type PostEmbeddingRepository } from "../repositories/post-embeddings.js";
import {
  suggestionRepository,
  type SuggestionGuardStatus,
  type SuggestionRepository,
} from "../repositories/suggestions.js";
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

function toSuggestionGuardStatus(decision: GuardDecision): SuggestionGuardStatus {
  switch (decision) {
    case "ACCEPT":
      return "accept";
    case "REJECT":
      return "reject";
    case "REVIEW":
      return "review";
  }
}

export class SemanticImageRetrievalService {
  public constructor(
    private readonly posts: PostRepository = postRepository,
    private readonly postEmbeddings: PostEmbeddingRepository = postEmbeddingRepository,
    private readonly imageEmbeddings: ImageEmbeddingRepository = imageEmbeddingRepository,
    private readonly suggestions: SuggestionRepository = suggestionRepository,
  ) {}

  public async retrieve(
    postId: string,
    limit = DEFAULT_SEMANTIC_RETRIEVAL_LIMIT,
  ): Promise<SemanticImageRetrievalResult> {
    const post = await this.posts.findById(postId);
    if (!post) {
      throw new SemanticRetrievalError("Post was not found.", "post_not_found");
    }

    const embeddingModel = getEmbeddingModel();

    const postEmbedding = await this.postEmbeddings.findByPostId(
      post.id,
      embeddingModel,
    );
    if (!postEmbedding) {
      throw new SemanticRetrievalError("Post embedding was not found.", "post_embedding_not_found");
    }

    return {
      postId: post.id,
      candidates: await this.imageEmbeddings.findSimilar(
        postEmbedding.embedding,
        embeddingModel,
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
    const evaluatedCandidates: MatchingCandidateResult[] = [];

    for (const candidate of retrieved.candidates) {
      const guardResult = evaluateMismatchGuard({
        expectedSubject: post.expectedSubject,
        expectedCategory: post.expectedCategory,
        candidateSubject: candidate.subject,
        candidateCategory: candidate.category,
        visionConfidence: candidate.visionConfidence,
        semanticSimilarity: candidate.similarity,
      });
      const suggestion = await this.suggestions.create({
        postId: post.id,
        imageId: candidate.imageId,
        similarityScore: candidate.similarity,
        guardStatus: toSuggestionGuardStatus(guardResult.decision),
        reason: guardResult.reason,
      });

      evaluatedCandidates.push({
        imageId: candidate.imageId,
        suggestionId: suggestion.id,
        similarity: candidate.similarity,
        guardDecision: guardResult.decision,
        reasonCode: guardResult.reasonCode,
        reason: guardResult.reason,
      });
    }

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
