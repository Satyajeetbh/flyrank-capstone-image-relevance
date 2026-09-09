import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.resolve(__dirname, "..");
const MANIFEST_FILE = path.join(
  PROJECT_ROOT,
  "data",
  "corpus",
  "manifest.json",
);
const IMAGE_DIR = path.join(
  PROJECT_ROOT,
  "data",
  "corpus",
  "images",
);

const USER_AGENT = "FlyRank-AI-Image-Matching-Corpus/1.0";

async function downloadImage(image) {
  const outputPath = path.join(IMAGE_DIR, image.filename);

  try {
    await readFile(outputPath);

    console.log(`CACHE HIT ${image.id}`);
    return {
      id: image.id,
      status: "cached",
    };
  } catch {
    // File does not exist; continue with download.
  }

  const response = await fetch(image.downloadUrl, {
    headers: {
      "User-Agent": USER_AGENT,
    },
  });

  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status} ${response.statusText}`,
    );
  }

  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.startsWith("image/")) {
    throw new Error(
      `Expected image response but received "${contentType}".`,
    );
  }

  const buffer = Buffer.from(await response.arrayBuffer());

  await writeFile(outputPath, buffer);

  console.log(`DOWNLOADED ${image.id} -> ${image.filename}`);

  return {
    id: image.id,
    status: "downloaded",
  };
}

async function main() {
  await mkdir(IMAGE_DIR, { recursive: true });

  const manifestRaw = await readFile(MANIFEST_FILE, "utf8");
  const manifest = JSON.parse(manifestRaw);

  if (!Array.isArray(manifest.images)) {
    throw new Error("manifest.json must contain an images array.");
  }

  console.log(`Corpus images: ${manifest.images.length}`);

  let downloaded = 0;
  let cached = 0;
  let failed = 0;

  for (const image of manifest.images) {
    try {
      const result = await downloadImage(image);

      if (result.status === "downloaded") {
        downloaded += 1;
      } else {
        cached += 1;
      }
    } catch (error) {
      failed += 1;

      console.error(
        `FAILED ${image.id}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  console.log("\nCorpus download complete.");
  console.log(`Downloaded: ${downloaded}`);
  console.log(`Cached:    ${cached}`);
  console.log(`Failed:    ${failed}`);
  console.log(`Total:     ${manifest.images.length}`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

await main();