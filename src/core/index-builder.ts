import { readFileSync, existsSync, writeFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { tokenize, tokenizeWithPositions, detectLanguage } from "./tokenizer.js";
import { parsePage } from "./markdown.js";
import { normalizePageId, getPagesDir, getWikiDir, getIndexPath, listPageFiles, readText } from "./utils.js";
import { writeFileAtomic } from "./atomic-write.js";
import type { InvertedIndex, IndexEntry, PageMeta, IndexStats, Page } from "./types.js";

const INDEX_VERSION = 2;

export function buildIndex(projectDir: string): InvertedIndex {
  const wikiDir = getWikiDir(projectDir);
  const pagesDir = getPagesDir(projectDir);
  const entries: Record<string, IndexEntry> = {};
  const pages: Record<string, PageMeta> = {};
  const docLengths: Record<string, number> = {};
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

    const textToIndex = page ? page.body : raw;
    const lang = detectLanguage(textToIndex);
    const tokenPositions = tokenizeWithPositions(textToIndex, lang);
    const tokenList = tokenize(textToIndex, lang);
    docLengths[pageId] = tokenList.length;
    totalTerms += tokenList.length;

    const pagesMeta: PageMeta = page
      ? {
          id: pageId,
          title: page.frontmatter.title,
          path: relative(projectDir, filePath),
          type: page.frontmatter.type,
          confidence: page.frontmatter.confidence,
          tags: page.frontmatter.tags,
          updated: page.frontmatter.updated,
          length: tokenList.length,
        }
      : {
          id: pageId,
          title: pageId,
          path: relative(projectDir, filePath),
          type: "concept",
          confidence: "medium",
          tags: [],
          updated: new Date().toISOString().split("T")[0],
          length: tokenList.length,
        };

    pages[pageId] = pagesMeta;

    for (const [term, positions] of tokenPositions) {
      if (!entries[term]) {
        entries[term] = { docIds: [], positions: [], tf: {} };
      }
      const entry = entries[term];
      if (!entry.docIds.includes(pageId)) {
        entry.docIds.push(pageId);
      }
      entry.positions.push(...positions);
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
  const builtAt = new Date(index.builtAt);

  const checkDirs = [wikiDir, pagesDir];
  for (const dir of checkDirs) {
    if (!existsSync(dir)) continue;
    try {
      const entries = readdirSync(dir);
      for (const entry of entries) {
        const fullPath = join(dir, entry);
        try {
          const stat = statSync(fullPath);
          if (stat.isFile() && stat.mtime > builtAt) {
            return true;
          }
        } catch {
          continue;
        }
      }
    } catch {
      continue;
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