import { existsSync, mkdirSync, rmdirSync, statSync, unlinkSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { createHash } from "node:crypto";

const LOCK_DIR_NAME = "memory/.wiki-agent/locks";
const STALE_LOCK_MS = 30_000; // 30 seconds
const DEFAULT_TIMEOUT_MS = 10_000; // 10 seconds
const RETRY_BASE_MS = 50;

function getLockDir(projectDir: string): string {
  return join(projectDir, LOCK_DIR_NAME);
}

function ensureLockDir(projectDir: string): void {
  const dir = getLockDir(projectDir);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function hashFilePath(filePath: string): string {
  const absPath = resolve(filePath);
  return createHash("sha256").update(absPath).digest("hex").slice(0, 16);
}

export function findProjectDir(filePath: string): string {
  let dir = dirname(resolve(filePath));
  const root = resolve("/");
  while (dir !== root) {
    // Check new memory/ structure first
    if (existsSync(join(dir, "memory", ".wiki-agent")) || existsSync(join(dir, "memory", "wiki"))) {
      return dir;
    }
    // Fallback to legacy root-level structure
    if (existsSync(join(dir, ".wiki-agent")) || existsSync(join(dir, "wiki"))) {
      console.warn(
        `[wiki-agent] Using legacy wiki structure at project root. Run 'wiki-agent update' to migrate to memory/.`,
      );
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(
    `Could not find project root for ${filePath}. Missing memory/.wiki-agent, memory/wiki, .wiki-agent, or wiki/ directory.`,
  );
}

function isLockStale(lockPath: string): boolean {
  try {
    const stat = statSync(lockPath);
    return Date.now() - stat.mtime.getTime() > STALE_LOCK_MS;
  } catch {
    return false;
  }
}

function tryAcquireLock(lockPath: string): boolean {
  try {
    mkdirSync(lockPath, { recursive: false });
    return true;
  } catch (err: any) {
    if (err.code === "EEXIST") {
      if (isLockStale(lockPath)) {
        try {
          rmdirSync(lockPath);
          mkdirSync(lockPath, { recursive: false });
          return true;
        } catch {
          return false;
        }
      }
      return false;
    }
    throw err;
  }
}

function sleepSync(ms: number): void {
  const start = Date.now();
  while (Date.now() - start < ms) {
    // busy wait — acceptable for short lock delays in CLI tooling
  }
}

function acquireLock(lockPath: string, timeoutMs: number = DEFAULT_TIMEOUT_MS): void {
  const startTime = Date.now();
  while (!tryAcquireLock(lockPath)) {
    if (Date.now() - startTime > timeoutMs) {
      throw new Error(`Failed to acquire lock at ${lockPath} within ${timeoutMs}ms`);
    }
    const delay = RETRY_BASE_MS + Math.floor(Math.random() * RETRY_BASE_MS);
    sleepSync(delay);
  }
}

function releaseLock(lockPath: string): void {
  try {
    rmdirSync(lockPath);
  } catch {
    // Best effort — lock may have been cleaned up by another process
  }
}

/**
 * Execute a function while holding a file-level lock.
 * Two processes writing different files do not block each other.
 */
export function withFileLock<T>(filePath: string, fn: () => T, timeoutMs?: number): T {
  const projectDir = findProjectDir(filePath);
  ensureLockDir(projectDir);
  const lockPath = join(getLockDir(projectDir), `${hashFilePath(filePath)}.lock`);
  acquireLock(lockPath, timeoutMs);
  try {
    return fn();
  } finally {
    releaseLock(lockPath);
  }
}

/**
 * Execute a function while holding the global index lock.
 * Index rebuilds are exclusive relative to any other wiki write operation.
 */
export function withIndexLock<T>(projectDir: string, fn: () => T, timeoutMs?: number): T {
  ensureLockDir(projectDir);
  const lockPath = join(getLockDir(projectDir), "index.lock");
  acquireLock(lockPath, timeoutMs);
  try {
    return fn();
  } finally {
    releaseLock(lockPath);
  }
}
