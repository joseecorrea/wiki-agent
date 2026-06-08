import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { withFileLock } from "./lock.js";
import { writeFileAtomic } from "./atomic-write.js";

export const MEMORY_DIR_NAME = "memory";
export const WIKI_DIR_NAME = "wiki";
export const RAW_DIR_NAME = "raw";
export const INDEX_DIR_NAME = ".wiki-agent";
export const INDEX_FILE_NAME = "index.json";
export const PAGES_DIR_NAME = "pages";

export function getMemoryDir(projectDir: string): string {
  return join(projectDir, MEMORY_DIR_NAME);
}

export function getWikiDir(projectDir: string): string {
  return join(getMemoryDir(projectDir), WIKI_DIR_NAME);
}

export function getRawDir(projectDir: string): string {
  return join(getMemoryDir(projectDir), RAW_DIR_NAME);
}

export function getPagesDir(projectDir: string): string {
  return join(getWikiDir(projectDir), PAGES_DIR_NAME);
}

export function getIndexPath(projectDir: string): string {
  return join(getMemoryDir(projectDir), INDEX_DIR_NAME, INDEX_FILE_NAME);
}

export function getIndexDir(projectDir: string): string {
  return join(getMemoryDir(projectDir), INDEX_DIR_NAME);
}

/**
 * Resolve a path relative to a base directory, ensuring the result stays within the base.
 * Throws if path traversal (e.g. `../`) would escape the base directory.
 */
export function resolveSafePath(baseDir: string, ...segments: string[]): string {
  const resolved = resolve(baseDir, ...segments);
  const normalizedBase = resolve(baseDir);
  const prefix = normalizedBase.endsWith(sep) ? normalizedBase : normalizedBase + sep;
  if (!resolved.startsWith(prefix) && resolved !== normalizedBase) {
    throw new Error(`Path traversal blocked: ${resolved} escapes allowed directory ${baseDir}`);
  }
  return resolved;
}

export function normalizePageId(filePath: string): string {
  return filePath
    .replace(/\.md$/, "")
    .replace(/\\/g, "/")
    .toLowerCase();
}

export function getPagePath(projectDir: string, pageId: string): string {
  return resolveSafePath(projectDir, MEMORY_DIR_NAME, WIKI_DIR_NAME, PAGES_DIR_NAME, `${pageId}.md`);
}

import { readdirSync, statSync } from "node:fs";

export function listPageFiles(projectDir: string): string[] {
  const pagesDir = getPagesDir(projectDir);
  if (!existsSync(pagesDir)) return [];
  return walkDir(pagesDir, ".md");
}

function walkDir(dir: string, ext: string): string[] {
  const results: string[] = [];
  if (!existsSync(dir)) return results;
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      results.push(...walkDir(fullPath, ext));
    } else if (entry.endsWith(ext)) {
      results.push(fullPath);
    }
  }
  return results;
}

export function ensureDir(filePath: string): void {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

export function readText(filePath: string): string | null {
  if (!existsSync(filePath)) return null;
  return readFileSync(filePath, "utf-8");
}

export function writeText(filePath: string, content: string): void {
  ensureDir(filePath);
  withFileLock(filePath, () => {
    writeFileAtomic(filePath, content);
  });
}

export function resolveRelativeTo(projectDir: string, filePath: string): string {
  return resolveSafePath(projectDir, filePath);
}