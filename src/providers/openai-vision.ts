import OpenAI from "openai";
import { z } from "zod";

import type { ImageMetadata } from "../domain/image-metadata.js";
import type { ProviderResult, ProviderUsage } from "../domain/ai-usage.js";

export const OPENAI_VISION_MODEL = "gpt-4.1-mini" as const;

const imageMetadataOutputSchema = z
  .object({
    subject: z.string().trim().min(1),
    category: z.string().trim().min(1),
    attributes: z.array(z.string().trim()),
    caption: z.string().trim().min(1),
    confidence: z.number().finite().min(0).max(1),
  })
  .strict();

const imageMetadataJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    subject: { type: "string", description: "The primary visual subject." },
    category: { type: "string", description: "The subject's primary category." },
    attributes: { type: "array", items: { type: "string" }, description: "Relevant visual attributes." },
    caption: { type: "string", description: "A concise description of the image." },
    confidence: { type: "number", description: "Confidence from 0 to 1." },
  },
  required: ["subject", "category", "attributes", "caption", "confidence"],
} as const;

const IMAGE_UNDERSTANDING_INSTRUCTION =
  "Identify the primary visual subject and its relevant category and attributes. Return only the requested structured fields; do not add commentary.";

export interface OpenAIVisionInput {
  imageUrl: string;
}

export type OpenAIVisionErrorKind = "provider_api_failure" | "invalid_model_output";

export class OpenAIVisionError extends Error {
  public constructor(
    message: string,
    public readonly kind: OpenAIVisionErrorKind,
  ) {
    super(message);
    this.name = "OpenAIVisionError";
  }
}

const visionUsageSchema = z.object({
  input_tokens: z.number().int().nonnegative(),
  output_tokens: z.number().int().nonnegative(),
});

export function parseVisionUsage(rawUsage: unknown): ProviderUsage | null {
  if (rawUsage === undefined || rawUsage === null) {
    return null;
  }

  const parsed = visionUsageSchema.safeParse(rawUsage);
  if (!parsed.success) {
    throw new OpenAIVisionError("OpenAI vision usage failed validation.", "invalid_model_output");
  }

  return {
    provider: "openai",
    model: OPENAI_VISION_MODEL,
    inputUnits: parsed.data.input_tokens,
    outputUnits: parsed.data.output_tokens,
  };
}

export function parseImageMetadata(rawOutput: unknown): ImageMetadata {
  const parsed = imageMetadataOutputSchema.safeParse(rawOutput);

  if (!parsed.success) {
    throw new OpenAIVisionError("OpenAI vision output failed metadata validation.", "invalid_model_output");
  }

  return parsed.data;
}

export function parseVisionJson(rawOutput: string): unknown {
  try {
    return JSON.parse(rawOutput) as unknown;
  } catch {
    throw new OpenAIVisionError(
      "OpenAI vision output was not valid JSON.",
      "invalid_model_output",
    );
  }
}

export class OpenAIVisionProvider {
  private readonly client: OpenAI;

  public constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey?.trim()) {
      throw new OpenAIVisionError("OPENAI_API_KEY is not configured.", "provider_api_failure");
    }

    this.client = new OpenAI({ apiKey });
  }

  public async understandImage(input: OpenAIVisionInput): Promise<ProviderResult<ImageMetadata>> {
    let response: OpenAI.Responses.Response;

    try {
      response = await this.client.responses.create({
        model: OPENAI_VISION_MODEL,
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: IMAGE_UNDERSTANDING_INSTRUCTION },
              { type: "input_image", image_url: input.imageUrl, detail: "auto" },
            ],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "image_metadata",
            strict: true,
            schema: imageMetadataJsonSchema,
          },
        },
      });
    } catch {
      throw new OpenAIVisionError("OpenAI vision request failed.", "provider_api_failure");
    }

    const rawOutput = parseVisionJson(response.output_text);

    return {
      output: parseImageMetadata(rawOutput),
      usage: parseVisionUsage(response.usage),
    };
  }
}
