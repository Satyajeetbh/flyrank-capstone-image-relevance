import { Router } from "express";
import { z } from "zod";

import {
  SemanticImageRetrievalService,
  SemanticRetrievalError,
} from "../application/semantic-image-retrieval.js";

const routeParametersSchema = z.object({
  id: z.string().uuid(),
});

export function createPostImageRetrievalRouter(
  retrievalService = new SemanticImageRetrievalService(),
): Router {
  const router = Router();

  router.get("/posts/:id/images", async (request, response) => {
    const parameters = routeParametersSchema.safeParse(request.params);
    if (!parameters.success) {
      response.status(400).json({ error: "Invalid post ID." });
      return;
    }

    try {
      const result = await retrievalService.retrieve(parameters.data.id);
      response.status(200).json(result);
    } catch (error: unknown) {
      if (error instanceof SemanticRetrievalError) {
        response.status(404).json({ error: error.message });
        return;
      }

      response.status(500).json({ error: "Unable to retrieve image candidates." });
    }
  });

  return router;
}
