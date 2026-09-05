import {
  checkRedisConnection,
  closeRedisConnection,
} from "../dist/infrastructure/redis.js";

try {
  await checkRedisConnection();
  console.log("Redis connection verified.");
} finally {
  await closeRedisConnection();
}