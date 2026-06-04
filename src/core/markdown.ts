import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import type { PageFrontmatter, Page, PageType, Confidence } from "./types.js";

const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;

export function parseFrontmatter(raw: string): { frontmatter: Record<string, unknown>; body: string } | null {
  const match = raw.match(FRONTMATTER_REGEX);
  if (!match) return null;
  try {
    const frontmatter = parseYaml(match[1]) as Record<string, unknown>;
    const body = match[2];
    return { frontmatter, body };
  } catch {
    return null;
  }
}

export function parsePage(raw: string, filePath: string): Page | null {
  const parsed = parseFrontmatter(raw);
  if (!parsed) return null;

  const fm = parsed.frontmatter;
  const frontmatter: PageFrontmatter = {
    title: String(fm.title ?? ""),
    created: String(fm.created ?? new Date().toISOString().split("T")[0]),
    updated: String(fm.updated ?? new Date().toISOString().split("T")[0]),
    tags: Array.isArray(fm.tags) ? fm.tags.map(String) : [],
    sources: Array.isArray(fm.sources) ? fm.sources.map(String) : [],
    type: validatePageType(fm.type),
    confidence: validateConfidence(fm.confidence),
    related: Array.isArray(fm.related) ? fm.related.map(String) : [],
  };

  return {
    path: filePath,
    frontmatter,
    body: parsed.body,
    raw,
  };
}

function validatePageType(value: unknown): PageType {
  const valid: PageType[] = ["architecture", "decision", "pattern", "gotcha", "entity", "concept"];
  if (typeof value === "string" && valid.includes(value as PageType)) return value as PageType;
  return "concept";
}

function validateConfidence(value: unknown): Confidence {
  const valid: Confidence[] = ["high", "medium", "low"];
  if (typeof value === "string" && valid.includes(value as Confidence)) return value as Confidence;
  return "medium";
}

export function stringifyPage(page: Page): string {
  const fm: Record<string, unknown> = {
    title: page.frontmatter.title,
    created: page.frontmatter.created,
    updated: page.frontmatter.updated,
    tags: page.frontmatter.tags,
    sources: page.frontmatter.sources,
    type: page.frontmatter.type,
    confidence: page.frontmatter.confidence,
    related: page.frontmatter.related,
  };
  return `---\n${stringifyYaml(fm, { lineWidth: 0 }).trim()}\n---\n${page.body}`;
}

export function extractWikiLinks(body: string): string[] {
  const linkRegex = /\[\[([^\]]+)\]\]/g;
  const links: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = linkRegex.exec(body)) !== null) {
    links.push(match[1]);
  }
  return [...new Set(links)];
}