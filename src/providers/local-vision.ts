import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

import type { ImageMetadata } from "../domain/image-metadata.js";
import type { ProviderResult } from "../domain/ai-usage.js";
import type { VisionInput, VisionProvider } from "./vision.js";
import { imageMetadataSchema } from "../domain/image-metadata-schema.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const METADATA_DIR = path.resolve(
  __dirname,
  "../../data/corpus/metadata",
);



export class LocalVisionProvider implements VisionProvider {
  public async understandImage(
    input: VisionInput,
  ): Promise<ProviderResult<ImageMetadata>> {
    const metadataFilename = `${input.imageId}.json`;
    const metadataPath = path.join(METADATA_DIR, metadataFilename);

    let rawMetadata: string;

    try {
      rawMetadata = await readFile(metadataPath, "utf8");
    } catch {
      throw new Error(
        `Local vision metadata was not found for image "${input.imageId}".`,
      );
    }

    let parsedJson: unknown;

    try {
      parsedJson = JSON.parse(rawMetadata) as unknown;
    } catch {
      throw new Error(
        `Local vision metadata for image "${input.imageId}" is not valid JSON.`,
      );
    }

    const parsedMetadata = imageMetadataSchema.safeParse(parsedJson);

    if (!parsedMetadata.success) {
      throw new Error(
        `Local vision metadata for image "${input.imageId}" failed validation.`,
      );
    }

    return {
      output: parsedMetadata.data,
      usage: null,
    };
  }
}