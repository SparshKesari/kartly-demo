import fs from "fs";
import path from "path";
import type { DB } from "./types";

type CacheEntry = { db: DB; mtimeMs: number; size: number };

type DbState = {
  cache: CacheEntry | null;
  queue: Promise<unknown>;
  resetHooks: Set<() => void>;
};

const globalKey = "__kartlyDbState";
const g = globalThis as unknown as Record<string, DbState | undefined>;

function state(): DbState {
  let s = g[globalKey];
  if (!s) {
    s = { cache: null, queue: Promise.resolve(), resetHooks: new Set() };
    g[globalKey] = s;
  }
  return s;
}

export function dataDir(): string {
  // On Vercel the deployment folder is read-only, so the live database goes to /tmp (per instance, reset on cold start).
  const dir = process.env.KARTLY_DATA_DIR || (process.env.VERCEL ? "/tmp/kartly" : "./data");
  return path.resolve(process.cwd(), dir);
}

export function dbPath(): string {
  return path.join(dataDir(), "db.json");
}

export function seedPath(): string {
  return path.resolve(process.cwd(), "data", "seed.json");
}

/** Copies the pristine seed into the live db location if the live db is missing. */
export function ensureDb(): void {
  const file = dbPath();
  if (fs.existsSync(file)) return;
  const seed = seedPath();
  if (!fs.existsSync(seed)) {
    throw new Error(`Seed file not found at ${seed}. Run "npm run seed" first.`);
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  writeAtomic(file, fs.readFileSync(seed, "utf8"));
}

function writeAtomic(file: string, contents: string): void {
  const tmp = `${file}.tmp`;
  const fd = fs.openSync(tmp, "w");
  try {
    fs.writeFileSync(fd, contents, "utf8");
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(tmp, file);
}

function loadFromDisk(): DB {
  ensureDb();
  const file = dbPath();
  const s = state();
  const stat = fs.statSync(file);
  if (s.cache && s.cache.mtimeMs === stat.mtimeMs && s.cache.size === stat.size) {
    return s.cache.db;
  }
  const db = JSON.parse(fs.readFileSync(file, "utf8")) as DB;
  s.cache = { db, mtimeMs: stat.mtimeMs, size: stat.size };
  return db;
}

function persist(db: DB): void {
  const file = dbPath();
  writeAtomic(file, JSON.stringify(db, null, 2));
  const stat = fs.statSync(file);
  state().cache = { db, mtimeMs: stat.mtimeMs, size: stat.size };
}

/** Returns the current database snapshot. Treat the result as read-only. */
export function read(): DB {
  return loadFromDisk();
}

/**
 * Runs `fn` on a private copy of the database under an in-process mutex.
 * The copy is written to disk (atomically) before the promise resolves.
 * If `fn` throws, nothing is written and the error is re-thrown.
 */
export function mutate<T>(fn: (db: DB) => T | Promise<T>): Promise<T> {
  const s = state();
  const run = async (): Promise<T> => {
    const draft = structuredClone(loadFromDisk());
    const result = await fn(draft);
    persist(draft);
    return result;
  };
  const next = s.queue.then(run, run);
  s.queue = next.catch(() => undefined);
  return next;
}

/** Runs a read-only function after all queued mutations have been flushed. */
export function readLocked<T>(fn: (db: DB) => T): Promise<T> {
  const s = state();
  const run = async (): Promise<T> => fn(loadFromDisk());
  const next = s.queue.then(run, run);
  s.queue = next.catch(() => undefined);
  return next;
}

/** Registers a callback that clears in-memory state when the database is reset. */
export function onReset(hook: () => void): void {
  state().resetHooks.add(hook);
}

/** Restores the live database from the pristine seed and clears in-memory state. */
export function resetDb(): Promise<void> {
  const s = state();
  const run = async () => {
    const seed = seedPath();
    if (!fs.existsSync(seed)) {
      throw new Error(`Seed file not found at ${seed}. Run "npm run seed" first.`);
    }
    fs.mkdirSync(dataDir(), { recursive: true });
    writeAtomic(dbPath(), fs.readFileSync(seed, "utf8"));
    s.cache = null;
    s.resetHooks.forEach((hook) => hook());
  };
  const next = s.queue.then(run, run);
  s.queue = next.catch(() => undefined);
  return next;
}
