import { pool } from "./dist/infrastructure/database.js";

const result = await pool.query(
  "SELECT id, source_url, storage_reference, processing_status FROM images WHERE storage_reference LIKE 'corpus/%' ORDER BY storage_reference"
);

console.table(result.rows);
console.log("Corpus records:", result.rows.length);

await pool.end();
