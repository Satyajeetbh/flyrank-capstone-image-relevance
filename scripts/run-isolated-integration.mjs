import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";

const labelsUrl = new URL("../data/evaluation/labeled-posts.json", import.meta.url);
const integrationTests = [
  "tests/integration/embeddings.test.mjs",
  "tests/integration/semantic-image-retrieval.test.mjs",
  "tests/integration/matching-workflow.test.mjs",
  "tests/integration/suggestion-review.test.mjs",
  "tests/integration/ai-usage.test.mjs",
];

let closeDatabasePool;
let failed = false;
let originalStatuses = [];

try {
  const labels = JSON.parse(await readFile(labelsUrl, "utf8"));
  const database = await import("../dist/infrastructure/database.js");
  closeDatabasePool = database.closeDatabasePool;

  const evaluationImageIds = labels.map((label) => label.expectedImageId);
  const result = await database.pool.query(
    "SELECT id, processing_status FROM images WHERE id = ANY($1::uuid[])",
    [evaluationImageIds],
  );
  originalStatuses = result.rows;

  for (const image of originalStatuses) {
    await database.pool.query(
      "UPDATE images SET processing_status = 'processing' WHERE id = $1",
      [image.id],
    );
  }

  const child = spawn(process.execPath, ["--test", "--test-concurrency=1", ...integrationTests], {
    env: process.env,
    stdio: "inherit",
  });
  const childExitCode = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code) => resolve(code ?? 1));
  });
  failed = childExitCode !== 0;
} catch {
  failed = true;
  console.error("Isolated integration test execution failed.");
} finally {
  try {
    const database = await import("../dist/infrastructure/database.js");
    for (const image of originalStatuses) {
      await database.pool.query(
        "UPDATE images SET processing_status = $2 WHERE id = $1",
        [image.id, image.processing_status],
      );
    }
  } catch {
    failed = true;
    console.error("Integration test fixture restoration failed.");
  }

  if (closeDatabasePool) {
    try {
      await closeDatabasePool();
    } catch {
      failed = true;
      console.error("Integration isolation database pool shutdown failed.");
    }
  }
}

process.exitCode = failed ? 1 : 0;
