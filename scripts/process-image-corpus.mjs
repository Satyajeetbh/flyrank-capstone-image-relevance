import { readFile, copyFile, unlink } from "node:fs/promises";
import path from "node:path";

import { imageRepository } from "../dist/repositories/images.js";
import { enqueueImageProcessingJob } from "../dist/application/image-processing-jobs.js";
import {
  createImageProcessingWorker,
  closeImageProcessingWorker,
} from "../dist/workers/image-processing-worker.js";
import { jobRepository } from "../dist/repositories/jobs.js";

process.env.VISION_PROVIDER = "local";
process.env.EMBEDDING_PROVIDER = "gemini";

const root = process.cwd();
const manifestPath = path.join(root, "data/corpus/manifest.json");
const metadataDir = path.join(root, "data/corpus/metadata");

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

if (!Array.isArray(manifest.images) || manifest.images.length !== 50) {
  throw new Error(`Expected exactly 50 corpus images, found ${manifest.images?.length ?? 0}.`);
}

const existingImages = await imageRepository.list();
const existingByReference = new Map(
  existingImages
    .filter((image) => image.storageReference?.startsWith("corpus/"))
    .map((image) => [image.storageReference, image]),
);

const created = [];
const temporaryMetadataFiles = [];

for (const corpusImage of manifest.images) {
  const storageReference = `corpus/${corpusImage.id}`;

  if (existingByReference.has(storageReference)) {
    console.log(`Already exists: ${storageReference}`);
    continue;
  }

  const image = await imageRepository.create({
    sourceUrl: corpusImage.downloadUrl,
    storageReference,
    processingStatus: "pending",
  });

  const canonicalMetadataPath = path.join(
    metadataDir,
    `${corpusImage.id}.json`,
  );

  const temporaryMetadataPath = path.join(
    metadataDir,
    `${image.id}.json`,
  );

  await copyFile(canonicalMetadataPath, temporaryMetadataPath);
  temporaryMetadataFiles.push(temporaryMetadataPath);

  created.push({ image, corpusImage });
  console.log(`Created: ${storageReference}`);
}

console.log(`New corpus records: ${created.length}`);

if (created.length === 0) {
  console.log("Nothing to process.");
  process.exit(0);
}

const worker = createImageProcessingWorker();

try {
  await worker.waitUntilReady();

  const jobs = [];

  for (const item of created) {
    const job = await enqueueImageProcessingJob({
      imageId: item.image.id,
    });

    jobs.push({ ...item, job });
    console.log(`Enqueued: ${item.corpusImage.id}`);
  }

  for (const item of jobs) {
    while (true) {
      const job = await jobRepository.findById(item.job.jobId);

      if (!job) {
        throw new Error(`Job ${item.job.jobId} disappeared.`);
      }

      if (job.status === "completed") {
        console.log(`Completed: ${item.corpusImage.id}`);
        break;
      }

      if (job.status === "failed") {
        throw new Error(
          `Processing failed for ${item.corpusImage.id}: ${job.error ?? "unknown error"}`
        );
      }

      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  console.log("All corpus images processed successfully.");
} finally {
  await closeImageProcessingWorker(worker);

  for (const metadataPath of temporaryMetadataFiles) {
    await unlink(metadataPath).catch(() => {});
  }
}
