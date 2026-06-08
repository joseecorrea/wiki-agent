import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { MetricsData, MetricEvent, SearchResult } from "./types.js";
import { getIndexDir, listPageFiles, resolveSafePath } from "./utils.js";
import { writeFileAtomic } from "./atomic-write.js";
import { withFileLock } from "./lock.js";
import { estimateTokens, estimateFileTokens } from "./token-estimator.js";

const METRICS_FILE_NAME = "metrics.json";
const MAX_RECENT_EVENTS = 50;

function getMetricsPath(projectDir: string): string {
  return join(getIndexDir(projectDir), METRICS_FILE_NAME);
}

function createEmptyMetrics(): MetricsData {
  return {
    version: 1,
    totalTokensSaved: 0,
    totalOperations: 0,
    byTool: {},
    recentEvents: [],
    lastUpdated: new Date().toISOString(),
  };
}

function loadMetrics(projectDir: string): MetricsData {
  const path = getMetricsPath(projectDir);
  if (!existsSync(path)) {
    return createEmptyMetrics();
  }
  try {
    const raw = readFileSync(path, "utf-8");
    const parsed = JSON.parse(raw) as MetricsData;
    if (!parsed || typeof parsed !== "object" || parsed.version !== 1) {
      return createEmptyMetrics();
    }
    // Ensure all fields exist
    return {
      ...createEmptyMetrics(),
      ...parsed,
      recentEvents: Array.isArray(parsed.recentEvents) ? parsed.recentEvents : [],
      byTool: typeof parsed.byTool === "object" && parsed.byTool !== null ? parsed.byTool : {},
    };
  } catch {
    return createEmptyMetrics();
  }
}

function saveMetrics(projectDir: string, data: MetricsData): void {
  const path = getMetricsPath(projectDir);
  data.lastUpdated = new Date().toISOString();
  const json = JSON.stringify(data, null, 2);
  withFileLock(path, () => {
    writeFileAtomic(path, json);
  });
}

/**
 * Record a token-saving event.
 * @param projectDir - Project root directory.
 * @param tool - Name of the tool/operation (e.g., "wiki_search").
 * @param detail - Human-readable detail (e.g., the search query).
 * @param saved - Estimated tokens saved (must be >= 0).
 */
export function recordMetric(
  projectDir: string,
  tool: string,
  detail: string,
  saved: number,
): void {
  if (saved <= 0) return;

  const data = loadMetrics(projectDir);
  data.totalTokensSaved += saved;
  data.totalOperations += 1;

  if (!data.byTool[tool]) {
    data.byTool[tool] = { count: 0, tokensSaved: 0 };
  }
  data.byTool[tool].count += 1;
  data.byTool[tool].tokensSaved += saved;

  const event: MetricEvent = {
    tool,
    detail: detail.slice(0, 200),
    saved,
    timestamp: new Date().toISOString(),
  };
  data.recentEvents.unshift(event);
  if (data.recentEvents.length > MAX_RECENT_EVENTS) {
    data.recentEvents = data.recentEvents.slice(0, MAX_RECENT_EVENTS);
  }

  saveMetrics(projectDir, data);
}

/**
 * Get current metrics data (read-only; returns a copy).
 */
export function getMetrics(projectDir: string): MetricsData {
  const data = loadMetrics(projectDir);
  return { ...data, byTool: { ...data.byTool }, recentEvents: [...data.recentEvents] };
}

/**
 * Estimate tokens saved for a search operation.
 * Conservatively: total tokens of full page contents found minus tokens of excerpts returned.
 */
export function estimateSearchTokensSaved(
  projectDir: string,
  results: SearchResult[],
): number {
  let fullTokens = 0;
  for (const r of results) {
    const pagePath = resolveSafePath(projectDir, r.path);
    fullTokens += estimateFileTokens(pagePath);
  }
  const excerptText = results.map((r) => r.excerpt).join("\n");
  const excerptTokens = estimateTokens(excerptText);
  const saved = fullTokens - excerptTokens;
  return Math.max(0, saved);
}

/**
 * Estimate tokens saved for a status/lint/judge operation.
 * Conservatively: total tokens of the entire wiki minus tokens of the structured response.
 */
export function estimateWikiTokensSaved(
  projectDir: string,
  responseText: string,
): number {
  const pageFiles = listPageFiles(projectDir);
  let wikiTokens = 0;
  for (const file of pageFiles) {
    wikiTokens += estimateFileTokens(file);
  }
  const responseTokens = estimateTokens(responseText);
  const saved = wikiTokens - responseTokens;
  return Math.max(0, saved);
}
