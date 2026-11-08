// node tests/seed/load.mjs <path to the learner's repository>
// Runs the learner's db/schema.sql, then DW's own seed. Tables the learner has not made yet are skipped.
import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import { loadDwSeed } from "./dw-seed.mjs";

const learner = path.resolve(process.argv[2] ?? "../learner");
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
try {
  await db.query("set time zone 'UTC'");
  await db.query(fs.readFileSync(path.join(learner, "db", "schema.sql"), "utf8"));
  console.log("The schema in db/schema.sql ran.");
  const result = await loadDwSeed(db);
  console.log(`DW seed loaded: ${result.loaded.join(", ") || "nothing"}.`);
  if (result.skipped.length) console.log(`DW seed skipped (the tables are not in your db/schema.sql yet): ${result.skipped.join(", ")}.`);
} catch (error) {
  console.error(`Chapter 4.4: your db/schema.sql did not run: ${error.message}`);
  process.exitCode = 1;
} finally {
  await db.end();
}
