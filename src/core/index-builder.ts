import { readFileSync, existsSync, writeFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, relative, dirname } from "node:path";
import { tokenize, tokenizeWithPositions, detectLanguage } from "./tokenizer.js";
import { parsePage } from "./markdown.js";
import { normalizePageId, getPagesDir, getWikiDir, getIndexPath, listPageFiles, readText } from "./utils.js";
import { writeFileAtomic } from "./atomic-write.js";
import type { InvertedIndex, IndexEntry, PageMeta, IndexStats, Page } from "./types.js";

const INDEX_VERSION = 3;

function computeFileHash(filePath: string): string {
  const data = readFileSync(filePath);
  return createHash("sha256").update(data).digest("hex");
}

function getPageIdForFile(filePath: string, wikiDir: string): string {
  const raw = readFileSync(filePath, "utf-8");
  const page = parsePage(raw, filePath);
  return page
    ? page.frontmatter.title.toLowerCase().replace(/\s+/g, "-")
    : normalizePageId(relative(wikiDir, filePath));
}

export function removePageFromIndex(index: InvertedIndex, pageId: string): void {
  const page = index.pages[pageId];
  if (!page) return;

  delete index.pages[pageId];
  delete index.stats.docLengths[pageId];

  for (const term of Object.keys(index.entries)) {
    const entry = index.entries[term];
    const docIdx = entry.docIds.indexOf(pageId);
    if (docIdx === -1) continue;

    entry.docIds.splice(docIdx, 1);
    delete entry.positions[pageId];
    delete entry.tf[pageId];

    if (entry.docIds.length === 0) {
      delete index.entries[term];
    }
  }

  // Recalculate stats
  index.stats.totalPages = Object.keys(index.pages).length;
  index.stats.totalTerms = Object.keys(index.entries).length;
  const totalDocLength = Object.values(index.stats.docLengths).reduce((sum, len) => sum + len, 0);
  index.stats.avgDocLength = index.stats.totalPages > 0 ? totalDocLength / index.stats.totalPages : 0;
}

export function updateIndex(projectDir: string, existingIndex: InvertedIndex): InvertedIndex {
  const wikiDir = getWikiDir(projectDir);
  const pagesDir = getPagesDir(projectDir);
  const index: InvertedIndex = {
    version: INDEX_VERSION,
    builtAt: new Date().toISOString(),
    entries: existingIndex.entries,
    pages: { ...existingIndex.pages },
    stats: {
      totalPages: existingIndex.stats.totalPages,
      totalTerms: existingIndex.stats.totalTerms,
      avgDocLength: existingIndex.stats.avgDocLength,
      docLengths: { ...existingIndex.stats.docLengths },
    },
    fileStates: { ...existingIndex.fileStates },
  };

  const currentFiles: string[] = [];
  if (existsSync(pagesDir)) {
    currentFiles.push(...listPageFiles(projectDir));
  }
  for (const specialFile of ["index.md", "overview.md", "log.md"]) {
    const fullPath = join(wikiDir, specialFile);
    if (existsSync(fullPath)) {
      currentFiles.push(fullPath);
    }
  }

  const currentFileSet = new Set<string>();
  const currentFileMap = new Map<string, string>(); // relPath -> absPath
  for (const absPath of currentFiles) {
    const relPath = relative(projectDir, absPath);
    currentFileSet.add(relPath);
    currentFileMap.set(relPath, absPath);
  }

  // Removed files
  const pathToPageId = new Map<string, string>();
  for (const [pageId, meta] of Object.entries(index.pages)) {
    pathToPageId.set(meta.path, pageId);
  }

  for (const relPath of Object.keys(index.fileStates)) {
    if (!currentFileSet.has(relPath)) {
      const pageId = pathToPageId.get(relPath);
      if (pageId) {
        removePageFromIndex(index, pageId);
      }
      delete index.fileStates[relPath];
    }
  }

  // Added or modified files
  for (const [relPath, absPath] of currentFileMap) {
    const hash = computeFileHash(absPath);
    const previous = index.fileStates[relPath];
    if (previous && previous.hash === hash) continue;

    // If modified, remove old entry first
    if (previous) {
      const oldPageId = pathToPageId.get(relPath);
      if (oldPageId) {
        removePageFromIndex(index, oldPageId);
      }
    }

    const raw = readFileSync(absPath, "utf-8");
    const page = parsePage(raw, absPath);
    const pageId = page
      ? page.frontmatter.title.toLowerCase().replace(/\s+/g, "-")
      : normalizePageId(relative(wikiDir, absPath));

    const textToIndex = page ? page.body : raw;
    const lang = detectLanguage(textToIndex);
    const tokenPositions = tokenizeWithPositions(textToIndex, lang);
    const tokenList = tokenize(textToIndex, lang);

    index.stats.docLengths[pageId] = tokenList.length;
    index.fileStates[relPath] = { hash };

    const pagesMeta: PageMeta = page
      ? {
          id: pageId,
          title: page.frontmatter.title,
          path: relPath,
          type: page.frontmatter.type,
          confidence: page.frontmatter.confidence,
          tags: page.frontmatter.tags,
          updated: page.frontmatter.updated,
          length: tokenList.length,
        }
      : {
          id: pageId,
          title: pageId,
          path: relPath,
          type: "concept",
          confidence: "medium",
          tags: [],
          updated: new Date().toISOString().split("T")[0],
          length: tokenList.length,
        };

    index.pages[pageId] = pagesMeta;

    for (const [term, positions] of tokenPositions) {
      if (!index.entries[term]) {
        index.entries[term] = { docIds: [], positions: {}, tf: {} };
      }
      const entry = index.entries[term];
      if (!entry.docIds.includes(pageId)) {
        entry.docIds.push(pageId);
      }
      entry.positions[pageId] = positions;
      entry.tf[pageId] = (entry.tf[pageId] ?? 0) + positions.length;
    }
  }

  // Recalculate stats
  index.stats.totalPages = Object.keys(index.pages).length;
  index.stats.totalTerms = Object.keys(index.entries).length;
  const totalDocLength = Object.values(index.stats.docLengths).reduce((sum, len) => sum + len, 0);
  index.stats.avgDocLength = index.stats.totalPages > 0 ? totalDocLength / index.stats.totalPages : 0;

  return index;
}

export function buildIndex(projectDir: string): InvertedIndex {
  const wikiDir = getWikiDir(projectDir);
  const pagesDir = getPagesDir(projectDir);
  const entries: Record<string, IndexEntry> = {};
  const pages: Record<string, PageMeta> = {};
  const docLengths: Record<string, number> = {};
  const fileStates: Record<string, { hash: string }> = {};
  let totalTerms = 0;

  const files: string[] = [];

  if (existsSync(pagesDir)) {
    files.push(...listPageFiles(projectDir));
  }

  for (const specialFile of ["index.md", "overview.md", "log.md"]) {
    const fullPath = join(wikiDir, specialFile);
    if (existsSync(fullPath)) {
      files.push(fullPath);
    }
  }

  for (let i = 0; i < files.length; i++) {
    const filePath = files[i];
    const raw = readFileSync(filePath, "utf-8");
    const page = parsePage(raw, filePath);
    const pageId = page ? page.frontmatter.title.toLowerCase().replace(/\s+/g, "-") : normalizePageId(relative(wikiDir, filePath));
    const fileRelPath = relative(projectDir, filePath);

    const textToIndex = page ? page.body : raw;
    const lang = detectLanguage(textToIndex);
    const tokenPositions = tokenizeWithPositions(textToIndex, lang);
    const tokenList = tokenize(textToIndex, lang);
    docLengths[pageId] = tokenList.length;
    totalTerms += tokenList.length;
    fileStates[fileRelPath] = { hash: computeFileHash(filePath) };

    const pagesMeta: PageMeta = page
      ? {
          id: pageId,
          title: page.frontmatter.title,
          path: fileRelPath,
          type: page.frontmatter.type,
          confidence: page.frontmatter.confidence,
          tags: page.frontmatter.tags,
          updated: page.frontmatter.updated,
          length: tokenList.length,
        }
      : {
          id: pageId,
          title: pageId,
          path: fileRelPath,
          type: "concept",
          confidence: "medium",
          tags: [],
          updated: new Date().toISOString().split("T")[0],
          length: tokenList.length,
        };

    pages[pageId] = pagesMeta;

    for (const [term, positions] of tokenPositions) {
      if (!entries[term]) {
        entries[term] = { docIds: [], positions: {}, tf: {} };
      }
      const entry = entries[term];
      if (!entry.docIds.includes(pageId)) {
        entry.docIds.push(pageId);
      }
      entry.positions[pageId] = positions;
      entry.tf[pageId] = (entry.tf[pageId] ?? 0) + positions.length;
    }
  }

  const totalPages = Object.keys(pages).length;
  const avgDocLength = totalPages > 0 ? totalTerms / totalPages : 0;

  const stats: IndexStats = {
    totalPages,
    totalTerms: Object.keys(entries).length,
    avgDocLength,
    docLengths,
  };

  return {
    version: INDEX_VERSION,
    builtAt: new Date().toISOString(),
    entries,
    pages,
    stats,
    fileStates,
  };
}

export function loadIndex(projectDir: string): InvertedIndex | null {
  const indexPath = getIndexPath(projectDir);
  if (!existsSync(indexPath)) return null;
  try {
    return JSON.parse(readFileSync(indexPath, "utf-8")) as InvertedIndex;
  } catch {
    return null;
  }
}

export function isIndexStale(projectDir: string, index: InvertedIndex): boolean {
  if (index.version !== INDEX_VERSION) return true;
  const wikiDir = getWikiDir(projectDir);
  const pagesDir = getPagesDir(projectDir);

  // Build current file set with hashes
  const currentFiles: string[] = [];
  if (existsSync(pagesDir)) {
    currentFiles.push(...listPageFiles(projectDir));
  }
  for (const specialFile of ["index.md", "overview.md", "log.md"]) {
    const fullPath = join(wikiDir, specialFile);
    if (existsSync(fullPath)) {
      currentFiles.push(fullPath);
    }
  }

  const currentFileSet = new Set<string>();
  for (const absPath of currentFiles) {
    currentFileSet.add(relative(projectDir, absPath));
  }

  // Detect removed files
  for (const relPath of Object.keys(index.fileStates)) {
    if (!currentFileSet.has(relPath)) {
      return true;
    }
  }

  // Detect added or modified files
  for (const absPath of currentFiles) {
    const relPath = relative(projectDir, absPath);
    const previous = index.fileStates[relPath];
    if (!previous) {
      return true;
    }
    try {
      const currentHash = computeFileHash(absPath);
      if (currentHash !== previous.hash) {
        return true;
      }
    } catch {
      return true;
    }
  }

  return false;
}

export function saveIndex(projectDir: string, index: InvertedIndex): void {
  const indexPath = getIndexPath(projectDir);
  const indexDir = dirname(indexPath);
  if (!existsSync(indexDir)) {
    mkdirSync(indexDir, { recursive: true });
  }
  writeFileAtomic(indexPath, JSON.stringify(index, null, 2));
}