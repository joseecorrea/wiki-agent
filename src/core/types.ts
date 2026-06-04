export type PageType = "architecture" | "decision" | "pattern" | "gotcha" | "entity" | "concept";
export type Confidence = "high" | "medium" | "low";

export interface PageFrontmatter {
  title: string;
  created: string;
  updated: string;
  tags: string[];
  sources: string[];
  type: PageType;
  confidence: Confidence;
  related: string[];
}

export interface Page {
  path: string;
  frontmatter: PageFrontmatter;
  body: string;
  raw: string;
}

export interface SearchResult {
  title: string;
  path: string;
  excerpt: string;
  score: number;
  type: string;
  confidence: string;
}

export interface ConflictPair {
  pageA: string;
  pageB: string;
  reason: "shared_tags" | "mutual_links" | "same_type_confidence_mismatch";
}

export interface LintReport {
  orphans: string[];
  stalePages: { path: string; lastUpdated: string }[];
  missingPages: string[];
  missingLinks: { from: string; missing: string }[];
  potentialConflicts: ConflictPair[];
  indexIssues: string[];
}

export interface IndexEntry {
  docIds: string[];
  positions: number[];
  tf: Record<string, number>;
}

export interface PageMeta {
  id: string;
  title: string;
  path: string;
  type: string;
  confidence: string;
  tags: string[];
  updated: string;
  length: number;
}

export interface IndexStats {
  totalPages: number;
  totalTerms: number;
  avgDocLength: number;
  docLengths: Record<string, number>;
}

export interface InvertedIndex {
  version: number;
  builtAt: string;
  entries: Record<string, IndexEntry>;
  pages: Record<string, PageMeta>;
  stats: IndexStats;
}

export type Harness = "opencode" | "claude-code" | "codex" | "cursor";

export interface WikiOptions {
  wikiDir: string;
  rawDir: string;
}

export interface InitOptions {
  projectDir: string;
  harnesses: Harness[];
}