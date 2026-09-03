import { Router, type Request, type Response } from "express";
import { z } from "zod";

import {
  SuggestionReviewError,
  SuggestionReviewService,
} from "../application/suggestion-review.js";

const routeParametersSchema = z.object({
  id: z.string().uuid(),
});

const approveBodySchema = z
  .object({
    reviewer: z.string().trim().min(1),
    reason: z.string().trim().min(1).optional(),
  })
  .strict();

const rejectBodySchema = z
  .object({
    reviewer: z.string().trim().min(1),
    reason: z.string().trim().min(1),
  })
  .strict();

export function createSuggestionReviewRouter(
  reviewService = new SuggestionReviewService(),
): Router {
  const router = Router();

  router.get("/suggestions/:id", async (request, response) => {
    const parameters = routeParametersSchema.safeParse(request.params);
    if (!parameters.success) {
      response.status(400).json({ error: "Invalid suggestion ID." });
      return;
    }

    try {
      response.status(200).json(await reviewService.getSuggestion(parameters.data.id));
    } catch (error: unknown) {
      if (error instanceof SuggestionReviewError) {
        response.status(404).json({ error: error.message });
        return;
      }

      response.status(500).json({ error: "Unable to retrieve suggestion." });
    }
  });

  router.post("/suggestions/:id/approve", async (request, response) => {
    await createReview(request, response, reviewService, approveBodySchema, "approved");
  });

  router.post("/suggestions/:id/reject", async (request, response) => {
    await createReview(request, response, reviewService, rejectBodySchema, "rejected");
  });

  return router;
}

async function createReview(
  request: Request,
  response: Response,
  reviewService: SuggestionReviewService,
  bodySchema: z.ZodType<{ reviewer: string; reason?: string | undefined }>,
  decision: "approved" | "rejected",
): Promise<void> {
  const parameters = routeParametersSchema.safeParse(request.params);
  if (!parameters.success) {
    response.status(400).json({ error: "Invalid suggestion ID." });
    return;
  }

  const body = bodySchema.safeParse(request.body);
  if (!body.success) {
    response.status(400).json({ error: "Invalid review request." });
    return;
  }

  try {
    const review = await reviewService.createReview(parameters.data.id, {
      decision,
      reviewer: body.data.reviewer,
      reason: body.data.reason ?? null,
    });
    response.status(201).json({ review });
  } catch (error: unknown) {
    if (error instanceof SuggestionReviewError) {
      response.status(404).json({ error: error.message });
      return;
    }

    response.status(500).json({ error: "Unable to create review." });
  }
}
