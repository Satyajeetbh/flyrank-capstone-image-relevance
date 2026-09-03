import {
  suggestionRepository,
  type SuggestionContextRecord,
  type SuggestionRepository,
} from "../repositories/suggestions.js";
import {
  reviewRepository,
  type CreateReviewInput,
  type ReviewRecord,
  type ReviewRepository,
} from "../repositories/reviews.js";

export type SuggestionReviewErrorKind = "suggestion_not_found";

export class SuggestionReviewError extends Error {
  public constructor(
    message: string,
    public readonly kind: SuggestionReviewErrorKind,
  ) {
    super(message);
    this.name = "SuggestionReviewError";
  }
}

export interface SuggestionReviewDetail extends SuggestionContextRecord {
  reviews: ReviewRecord[];
}

export class SuggestionReviewService {
  public constructor(
    private readonly suggestions: SuggestionRepository = suggestionRepository,
    private readonly reviews: ReviewRepository = reviewRepository,
  ) {}

  public async getSuggestion(id: string): Promise<SuggestionReviewDetail> {
    const suggestion = await this.findSuggestion(id);
    return {
      ...suggestion,
      reviews: await this.reviews.findBySuggestionId(id),
    };
  }

  public async createReview(
    suggestionId: string,
    input: Omit<CreateReviewInput, "suggestionId">,
  ): Promise<ReviewRecord> {
    await this.findSuggestion(suggestionId);
    return this.reviews.create({ suggestionId, ...input });
  }

  private async findSuggestion(id: string): Promise<SuggestionContextRecord> {
    const suggestion = await this.suggestions.findByIdWithContext(id);
    if (!suggestion) {
      throw new SuggestionReviewError("Suggestion was not found.", "suggestion_not_found");
    }

    return suggestion;
  }
}
