let closeDatabasePool;
let verificationFailed = false;

try {
  const database = await import("../dist/infrastructure/database.js");
  closeDatabasePool = database.closeDatabasePool;
  await database.checkDatabaseConnection();
  console.log("Database connectivity check passed.");
} catch {
  verificationFailed = true;
  console.error("Database connectivity check failed.");
} finally {
  if (closeDatabasePool) {
    try {
      await closeDatabasePool();
    } catch {
      verificationFailed = true;
      console.error("Database pool shutdown failed.");
    }
  }
}

process.exitCode = verificationFailed ? 1 : 0;
