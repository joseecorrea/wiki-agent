import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { buildIndex, saveIndex, loadIndex, isIndexStale } from "./index-builder.js";
import { search as bm25Search, getPageExcerpt } from "./search.js";
import { findPotentialConflicts } from "./judge.js";
import { parsePage, extractWikiLinks } from "./markdown.js";
import { getWikiDir, getPagesDir, listPageFiles, readText } from "./utils.js";
import { withIndexLock } from "./lock.js";
import type { SearchResult, LintReport, ConflictPair } from "./types.js";

export function searchWiki(projectDir: string, query: string, options?: { type?: string; confidence?: string; tags?: string[]; limit?: number }): SearchResult[] {
  let index = loadIndex(projectDir);
  if (!index || isIndexStale(projectDir, index)) {
    if (!existsSync(getWikiDir(projectDir))) return [];
    index = withIndexLock(projectDir, () => {
      // Double-check inside lock to avoid redundant rebuilds
      const current = loadIndex(projectDir);
      if (current && !isIndexStale(projectDir, current)) {
        return current;
      }
      const fresh = buildIndex(projectDir);
      saveIndex(projectDir, fresh);
      return fresh;
    });
  }

  const results = bm25Search(query, index, options);

  return results.map((r) => {
    const fullPath = join(projectDir, r.path);
    const raw = readText(fullPath);
    if (raw) {
      r.excerpt = getPageExcerpt(raw, query);
    }
    return r;
  });
}

export function buildAndSaveIndex(projectDir: string): number {
  return withIndexLock(projectDir, () => {
    const index = buildIndex(projectDir);
    saveIndex(projectDir, index);
    return index.stats.totalPages;
  });
}

export function lintWiki(projectDir: string): LintReport {
  const wikiDir = getWikiDir(projectDir);
  const pagesDir = getPagesDir(projectDir);

  if (!existsSync(wikiDir)) {
    return {
      orphans: [],
      stalePages: [],
      missingPages: [],
      missingLinks: [],
      potentialConflicts: [],
      indexIssues: ["Wiki directory does not exist"],
    };
  }

  const pageFiles = existsSync(pagesDir) ? listPageFiles(projectDir) : [];
  const pages = new Map<string, { path: string; frontmatter: ReturnType<typeof parsePage> }>();
  const allLinks = new Map<string, Set<string>>();
  const allPageNames = new Set<string>();

  for (const filePath of pageFiles) {
    const raw = readFileSync(filePath, "utf-8");
    const page = parsePage(raw, filePath);
    if (page) {
      const name = page.frontmatter.title.toLowerCase().replace(/\s+/g, "-");
      pages.set(name, { path: filePath, frontmatter: page });
      allPageNames.add(name);
      const links = extractWikiLinks(page.body);
      allLinks.set(name, new Set(links));
    }
  }

  const inboundLinks = new Map<string, Set<string>>();
  for (const [name, links] of allLinks) {
    for (const link of links) {
      if (!inboundLinks.has(link)) {
        inboundLinks.set(link, new Set());
      }
      inboundLinks.get(link)!.add(name);
    }
  }

  const orphans: string[] = [];
  for (const name of allPageNames) {
    if (!inboundLinks.has(name) || inboundLinks.get(name)!.size === 0) {
      orphans.push(name);
    }
  }

  const missingPages: string[] = [];
  const missingLinks: { from: string; missing: string }[] = [];
  for (const [name, links] of allLinks) {
    for (const link of links) {
      const resolvedLink = link.toLowerCase().replace(/\s+/g, "-");
      if (!allPageNames.has(resolvedLink)) {
        missingPages.push(resolvedLink);
        missingLinks.push({ from: name, missing: link });
      }
    }
  }
  const uniqueMissingPages = [...new Set(missingPages)];

  const stalePages: { path: string; lastUpdated: string }[] = [];
  const now = Date.now();
  const ninetyDays = 90 * 24 * 60 * 60 * 1000;
  for (const [name, data] of pages) {
    if (data.frontmatter) {
      const updated = new Date(data.frontmatter.frontmatter!.updated);
      if (now - updated.getTime() > ninetyDays) {
        stalePages.push({ path: name, lastUpdated: data.frontmatter.frontmatter!.updated });
      }
    }
  }

  let potentialConflicts: ConflictPair[] = [];
  const index = loadIndex(projectDir);
  if (index && !isIndexStale(projectDir, index)) {
    potentialConflicts = findPotentialConflicts(index);
  }

  const indexIssues: string[] = [];
  const indexPath = join(wikiDir, "..", ".wiki-agent", "index.json");
  if (!existsSync(indexPath)) {
    indexIssues.push("Index not built. Run `wiki-agent index` to create it.");
  }

  return {
    orphans,
    stalePages,
    missingPages: uniqueMissingPages,
    missingLinks,
    potentialConflicts,
    indexIssues,
  };
}

export function getWikiStatus(projectDir: string): {
  exists: boolean;
  totalPages: number;
  types: Record<string, number>;
  lastIndex: string | null;
  indexStale: boolean;
} {
  const wikiDir = getWikiDir(projectDir);
  if (!existsSync(wikiDir)) {
    return { exists: false, totalPages: 0, types: {}, lastIndex: null, indexStale: false };
  }

  const pageFiles = listPageFiles(projectDir);
  let totalPages = 0;
  const types: Record<string, number> = {};
  let lastIndex: string | null = null;
  let indexStale = false;

  for (const filePath of pageFiles) {
    const raw = readText(filePath);
    if (raw) {
      const page = parsePage(raw, filePath);
      if (page) {
        totalPages++;
        types[page.frontmatter.type] = (types[page.frontmatter.type] ?? 0) + 1;
      }
    }
  }

  const index = loadIndex(projectDir);
  if (index) {
    lastIndex = index.builtAt;
    indexStale = isIndexStale(projectDir, index);
  }

  return { exists: true, totalPages, types, lastIndex, indexStale };
}