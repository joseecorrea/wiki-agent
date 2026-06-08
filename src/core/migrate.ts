import { existsSync, readdirSync, renameSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";

export const MEMORY_DIR_NAME = "memory";

/**
 * Detects if the project has the old wiki structure (directories at project root)
 * and does NOT yet have the new memory/ structure.
 */
export function needsMigration(projectDir: string): boolean {
  const memoryDir = join(projectDir, MEMORY_DIR_NAME);
  // If memory/ already exists, no migration needed
  if (existsSync(memoryDir)) {
    return false;
  }

  // Check for any legacy wiki directories/files at root
  const legacyPaths = [
    join(projectDir, "wiki"),
    join(projectDir, "raw"),
    join(projectDir, ".wiki-agent"),
    join(projectDir, "wiki-spec.md"),
  ];

  return legacyPaths.some((p) => existsSync(p));
}

/**
 * Returns true if the project has a wiki in the new memory/ structure.
 */
export function hasMemoryWiki(projectDir: string): boolean {
  return existsSync(join(projectDir, MEMORY_DIR_NAME, "wiki"));
}

/**
 * Migrates legacy wiki structure (root-level) into memory/ directory.
 * - Moves wiki/, raw/, .wiki-agent/, wiki-spec.md into memory/
 * - Deletes stale index.json to force rebuild
 * - Throws if memory/ already exists and has content
 */
export function migrateLegacyWiki(projectDir: string): void {
  const memoryDir = join(projectDir, MEMORY_DIR_NAME);

  if (existsSync(memoryDir) && readdirSync(memoryDir).length > 0) {
    throw new Error(
      `Directory ${MEMORY_DIR_NAME}/ already exists and is not empty. Cannot migrate automatically.`,
    );
  }

  if (!existsSync(memoryDir)) {
    mkdirSync(memoryDir, { recursive: true });
  }

  const moves: { from: string; to: string }[] = [];

  const legacyItems = [
    { name: "wiki", isDir: true },
    { name: "raw", isDir: true },
    { name: ".wiki-agent", isDir: true },
    { name: "wiki-spec.md", isDir: false },
  ];

  for (const item of legacyItems) {
    const fromPath = join(projectDir, item.name);
    const toPath = join(memoryDir, item.name);
    if (existsSync(fromPath)) {
      moves.push({ from: fromPath, to: toPath });
    }
  }

  if (moves.length === 0) {
    throw new Error("No legacy wiki items found to migrate.");
  }

  // Execute moves
  for (const move of moves) {
    renameSync(move.from, move.to);
  }

  // Delete stale index to force rebuild on next search
  const staleIndex = join(memoryDir, ".wiki-agent", "index.json");
  if (existsSync(staleIndex)) {
    rmSync(staleIndex, { force: true });
  }
}
