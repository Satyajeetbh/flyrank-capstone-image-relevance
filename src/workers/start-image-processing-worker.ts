import {
  closeImageProcessingWorker,
  createImageProcessingWorker,
} from "./image-processing-worker.js";
import { closeDatabasePool } from "../infrastructure/database.js";
import { closeRedisConnection } from "../infrastructure/redis.js";

const worker = createImageProcessingWorker();

async function shutdown(signal: string): Promise<void> {
  console.info(`[image-processing-worker] received ${signal}, shutting down.`);

  await closeImageProcessingWorker(worker);
  await closeRedisConnection();
  await closeDatabasePool();

  process.exit(0);
}

process.once("SIGINT", () => {
  void shutdown("SIGINT");
});

process.once("SIGTERM", () => {
  void shutdown("SIGTERM");
});

console.info("[image-processing-worker] started.");