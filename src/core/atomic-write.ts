import { writeFileSync, renameSync, existsSync, unlinkSync } from "node:fs";
import { dirname, join, basename } from "node:path";
import { randomBytes } from "node:crypto";
import { ensureDir } from "./utils.js";

const MAX_RETRIES = 5;
const RETRY_BASE_MS = 50;

function sleepSync(ms: number): void {
  const start = Date.now();
  while (Date.now() - start < ms) {
    // busy wait — acceptable for short retry delays
  }
}

/**
 * Write a file atomically by writing to a temp file and renaming it.
 * Readers will always see a complete file (never a partial write).
 */
export function writeFileAtomic(filePath: string, content: string): void {
  ensureDir(filePath);
  const dir = dirname(filePath);
  const tmpName = `.tmp-${randomBytes(8).toString("hex")}-${basename(filePath)}`;
  const tmpPath = join(dir, tmpName);

  writeFileSync(tmpPath, content, "utf-8");

  let lastError: Error | undefined;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      renameSync(tmpPath, filePath);
      return;
    } catch (err: any) {
      lastError = err;
      if (err.code === "ENOENT" && !existsSync(tmpPath)) {
        throw new Error(
          `Atomic write failed: temp file ${tmpPath} disappeared before rename`,
        );
      }
      const delay = RETRY_BASE_MS * Math.pow(2, attempt);
      sleepSync(delay);
    }
  }

  // Cleanup temp file on persistent failure
  try {
    if (existsSync(tmpPath)) {
      unlinkSync(tmpPath);
    }
  } catch {
    // Best effort cleanup
  }

  throw (
    lastError ??
    new Error(`Atomic write failed after ${MAX_RETRIES} retries: ${filePath}`)
  );
}
