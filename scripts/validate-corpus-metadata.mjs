import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { imageMetadataSchema } from "../dist/domain/image-metadata-schema.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.resolve(__dirname, "..");
const MANIFEST_FILE = path.join(
  PROJECT_ROOT,
  "data",
  "corpus",
  "manifest.json",
);
const METADATA_DIR = path.join(
  PROJECT_ROOT,
  "data",
  "corpus",
  "metadata",
);

const manifest = JSON.parse(
  await readFile(MANIFEST_FILE, "utf8"),
);

if (!Array.isArray(manifest.images)) {
  throw new Error("manifest.json must contain an images array.");
}

const expectedIds = new Set(
  manifest.images.map((image) => image.id),
);

const metadataFiles = (await readdir(METADATA_DIR))
  .filter((file) => file.endsWith(".json"));

const actualIds = new Set(
  metadataFiles.map((file) => file.replace(/\.json$/, "")),
);

const missingIds = [...expectedIds].filter(
  (id) => !actualIds.has(id),
);

const unexpectedIds = [...actualIds].filter(
  (id) => !expectedIds.has(id),
);

if (missingIds.length > 0) {
  throw new Error(
    `Missing metadata files: ${missingIds.join(", ")}`,
  );
}

if (unexpectedIds.length > 0) {
  throw new Error(
    `Metadata files without manifest entries: ${unexpectedIds.join(", ")}`,
  );
}

let invalidCount = 0;

for (const image of manifest.images) {
  const metadataPath = path.join(
    METADATA_DIR,
    `${image.id}.json`,
  );

  let rawMetadata;

  try {
    rawMetadata = await readFile(metadataPath, "utf8");
  } catch {
    invalidCount += 1;
    console.error(`INVALID ${image.id}: could not read file`);
    continue;
  }

  let parsedJson;

  try {
    parsedJson = JSON.parse(rawMetadata);
  } catch {
    invalidCount += 1;
    console.error(`INVALID ${image.id}: invalid JSON`);
    continue;
  }

  const result = imageMetadataSchema.safeParse(parsedJson);

  if (!result.success) {
    invalidCount += 1;
    console.error(
      `INVALID ${image.id}: metadata failed schema validation`,
    );
    console.error(result.error.issues);
    continue;
  }

  console.log(`VALID ${image.id}`);
}

console.log("\nCorpus metadata validation complete.");
console.log(`Expected: ${expectedIds.size}`);
console.log(`Found:    ${actualIds.size}`);
console.log(`Invalid:  ${invalidCount}`);

if (invalidCount > 0) {
  process.exitCode = 1;
}