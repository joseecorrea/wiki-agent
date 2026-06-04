import { tokenize } from "./tokenizer.js";
import type { InvertedIndex, SearchResult } from "./types.js";

const K1 = 1.2;
const B = 0.75;

export interface SearchOptions {
  type?: string;
  confidence?: string;
  tags?: string[];
  limit?: number;
}

export function search(
  query: string,
  index: InvertedIndex,
  options: SearchOptions = {},
): SearchResult[] {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];

  const { type, confidence, tags, limit = 10 } = options;
  const scores: Record<string, number> = {};
  const { totalPages, avgDocLength, docLengths } = index.stats;

  for (const token of queryTokens) {
    const entry = index.entries[token];
    if (!entry) continue;

    const df = entry.docIds.length;
    const idf = Math.log((totalPages - df + 0.5) / (df + 0.5) + 1);

    for (const docId of entry.docIds) {
      const pageMeta = index.pages[docId];
      if (!pageMeta) continue;

      if (type && pageMeta.type !== type) continue;
      if (confidence && pageMeta.confidence !== confidence) continue;
      if (tags && tags.length > 0 && !tags.some((t) => pageMeta.tags.includes(t))) continue;

      const tf = entry.tf[docId] ?? 0;
      const dl = docLengths[docId] ?? avgDocLength;
      const tfNorm = (tf * (K1 + 1)) / (tf + K1 * (1 - B + B * (dl / avgDocLength)));

      scores[docId] = (scores[docId] ?? 0) + idf * tfNorm;
    }
  }

  const results = Object.entries(scores)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([docId, score]) => {
      const page = index.pages[docId];
      return {
        title: page.title,
        path: page.path,
        excerpt: "",
        score: Math.round(score * 1000) / 1000,
        type: page.type,
        confidence: page.confidence,
      };
    });

  return results;
}

export function getPageExcerpt(raw: string, query: string, maxLength = 200): string {
  const queryTokens = new Set(tokenize(query));
  const sentences = raw.replace(/\n+/g, " ").split(/(?<=[.!?])\s+/);
  let bestSentence = sentences[0] ?? raw.slice(0, maxLength);
  let bestScore = 0;

  for (const sentence of sentences) {
    const words = sentence.toLowerCase().split(/\s+/);
    const score = words.filter((w) => queryTokens.has(w)).length;
    if (score > bestScore) {
      bestScore = score;
      bestSentence = sentence;
    }
  }

  if (bestSentence.length > maxLength) {
    return bestSentence.slice(0, maxLength) + "...";
  }
  return bestSentence;
}