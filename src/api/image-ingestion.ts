import { Router } from "express";
import { z } from "zod";

import { imageRepository } from "../repositories/images.js";
import { enqueueImageProcessingJob } from "../application/image-processing-jobs.js";

const createImageSchema = z.object({
  sourceUrl: z.string().url(),
  storageReference: z.string().min(1).nullable().optional(),
});

export function createImageIngestionRouter(): Router {
  const router = Router();

  router.post("/images", async (request, response) => {
    const input = createImageSchema.safeParse(request.body);
  
    if (!input.success) {
      response.status(400).json({
        error: "Invalid image input.",
        details: input.error.flatten(),
      });
      return;
    }
  
    let image;
  
    try {
      image = await imageRepository.create({
        sourceUrl: input.data.sourceUrl,
        ...(input.data.storageReference !== undefined && {
          storageReference: input.data.storageReference,
        }),
      });
    } catch (error: unknown) {
      console.error("Failed to create image.", error);
  
      response.status(500).json({
        error: "Unable to create image.",
      });
      return;
    }
  
    try {
      const job = await enqueueImageProcessingJob({
        imageId: image.id,
      });
  
      response.status(201).json({
        image,
        job,
      });
    } catch (error: unknown) {
      console.error(
        `Image ${image.id} was created but processing could not be queued.`,
        error,
      );
  
      response.status(500).json({
        error: "Image was created but processing could not be queued.",
      });
    }
  });

  return router;
}