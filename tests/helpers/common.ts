import fs from "node:fs";
import path from "node:path";
import pg from "pg";

// Where the learner's repository is. In the workflow it is checked out next to this folder.
export const LEARNER = path.resolve(process.env.LEARNER ?? path.join(__dirname, "..", "..", "..", "learner"));
export const BASE = process.env.BASE_URL ?? "http://localhost:3000";
export const DOWN_BASE = process.env.BASE_URL_DOWN ?? "http://localhost:3001";

export const HUMAN_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

// A number that changes with each run but is the same inside one run.
export function runSeed(): number {
  const id = process.env.GITHUB_RUN_ID ?? process.env.DW_RUN_ID ?? String(Date.now());
  let h = 2166136261;
  for (const c of id) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const robots = fs
  .readFileSync(path.join(__dirname, "..", "robots.txt"), "utf8")
  .split("\n")
  .map((s) => s.trim())
  .filter(Boolean);

export function robotStrings(count: number, salt = 0): string[] {
  const random = rng(runSeed() + salt);
  const picked = new Set<string>();
  while (picked.size < Math.min(count, robots.length)) picked.add(robots[Math.floor(random() * robots.length)]);
  return [...picked];
}

export const ROBOT_POOL_SIZE = robots.length;

export function why(chapter: string, text: string): string {
  return `Chapter ${chapter}: ${text}`;
}

const TABLE_CHAPTER: Record<string, string> = {
  views: "4.4, part 2",
  sessions: "4.10",
  proposals: "5.4, part 2",
  recipients: "5.4, part 2",
  proposal_visits: "5.6, part 1",
  clicks: "6.3, part 1",
  reachouts: "6.4, part 1",
};

// A database error that says a table is missing becomes a plain message that names the chapter.
function plain(error: unknown): Error {
  const e = error as { code?: string; message?: string };
  const table = e.message?.match(/relation "([a-z_]+)" does not exist/)?.[1];
  if (e.code === "42P01" && table) {
    return new Error(`Chapter ${TABLE_CHAPTER[table] ?? "4.4"}: your database has no table "${table}". Add it to db/schema.sql and run node db/migrate.mjs.`);
  }
  return error instanceof Error ? error : new Error(String(error));
}

export async function withDb<T>(fn: (db: pg.Client) => Promise<T>): Promise<T> {
  const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    return await fn(db);
  } catch (error) {
    throw plain(error);
  } finally {
    await db.end();
  }
}

export async function count(sql: string, params: unknown[] = []): Promise<number> {
  return withDb(async (db) => Number((await db.query(sql, params)).rows[0].n));
}

export async function waitFor<T>(fn: () => Promise<T | null | false | undefined>, ms = 15000, every = 400): Promise<T | null> {
  const end = Date.now() + ms;
  for (;;) {
    const value = await fn();
    if (value) return value;
    if (Date.now() > end) return null;
    await new Promise((r) => setTimeout(r, every));
  }
}
