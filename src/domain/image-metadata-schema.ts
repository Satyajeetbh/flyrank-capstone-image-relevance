import { z } from "zod";

export const imageMetadataSchema = z
  .object({
    subject: z.string().trim().min(1),
    category: z.string().trim().min(1),
    attributes: z.array(z.string().trim()),
    caption: z.string().trim().min(1),
    confidence: z.number().finite().min(0).max(1),
  })
  .strict();