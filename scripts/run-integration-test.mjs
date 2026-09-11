import { spawn } from "node:child_process";

const testFiles = process.argv.slice(2);

if (testFiles.length === 0) {
  console.error("No integration test files were provided.");
  process.exitCode = 1;
  process.exit();
}

const child = spawn(
  process.execPath,
  ["--test", "--test-concurrency=1", ...testFiles],
  {
    env: {
      ...process.env,
      IMAGE_PROCESSING_QUEUE_NAME: "image-processing-test",
    },
    stdio: "inherit",
  },
);

child.once("error", (error) => {
  console.error("Integration test execution failed.", error);
  process.exitCode = 1;
});

child.once("close", (code) => {
  process.exitCode = code ?? 1;
});