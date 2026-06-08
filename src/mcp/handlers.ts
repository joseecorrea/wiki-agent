import { resolve } from "node:path";
import { searchWiki, lintWiki, getWikiStatus, buildAndSaveIndex } from "../core/wiki-ops.js";
import { findPotentialConflicts } from "../core/judge.js";
import { loadIndex, isIndexStale, buildIndex, saveIndex as saveIndexToDisk } from "../core/index-builder.js";
import { recordMetric, estimateSearchTokensSaved, estimateWikiTokensSaved } from "../core/metrics.js";
import { estimateTokens } from "../core/token-estimator.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

function getProjectDir(): string {
  return process.env.WIKI_AGENT_PROJECT_DIR ?? process.cwd();
}

function textResult(content: string): CallToolResult {
  return {
    content: [{ type: "text", text: content }],
  };
}

export async function handleSearch(args: { query: string; type?: string; confidence?: string; tags?: string }): Promise<CallToolResult> {
  const projectDir = getProjectDir();
  const results = searchWiki(projectDir, args.query, {
    type: args.type,
    confidence: args.confidence,
    tags: args.tags ? args.tags.split(",") : undefined,
  });

  if (results.length === 0) {
    return textResult("No results found for the given query.");
  }

  const output = results
    .map((r, i) => `${i + 1}. [[${r.title}]] (score: ${r.score}) | type: ${r.type} | confidence: ${r.confidence}\n   ${r.excerpt}`)
    .join("\n\n");

  const saved = estimateSearchTokensSaved(projectDir, results);
  if (saved > 0) {
    recordMetric(projectDir, "wiki_search", args.query, saved);
  }

  return textResult(output);
}

export async function handleIngest(args: { source: string; title?: string }): Promise<CallToolResult> {
  const projectDir = getProjectDir();
  const saved = estimateTokens(args.source) + (args.title ? estimateTokens(args.title) : 0);
  if (saved > 0) {
    recordMetric(projectDir, "wiki_ingest", args.source, saved);
  }
  return textResult(
    "Ingest operation requires sub-agent orchestration. Use the wiki-ingest sub-agent to process the source file and create/update wiki pages.",
  );
}

export async function handleUpdate(args: { page: string; content: string }): Promise<CallToolResult> {
  const projectDir = getProjectDir();
  const saved = estimateTokens(args.page) + estimateTokens(args.content);
  if (saved > 0) {
    recordMetric(projectDir, "wiki_update", args.page, saved);
  }
  return textResult(
    "Update operation requires sub-agent orchestration. Use the wiki-update sub-agent to modify wiki pages while maintaining consistency.",
  );
}

export async function handleAutoLearn(args: { facts: string }): Promise<CallToolResult> {
  const projectDir = getProjectDir();
  const saved = estimateTokens(args.facts);
  if (saved > 0) {
    recordMetric(projectDir, "wiki_auto_learn", "auto-learn session", saved);
  }
  return textResult(
    "Auto-learn operation requires sub-agent orchestration. Use the wiki-auto-learn sub-agent to integrate discovered knowledge into the wiki.",
  );
}

export async function handleLint(): Promise<CallToolResult> {
  const projectDir = getProjectDir();
  const report = lintWiki(projectDir);

  const lines: string[] = ["## Wiki Lint Report\n"];

  if (report.orphans.length > 0) {
    lines.push("### Orphan Pages");
    for (const o of report.orphans) lines.push(`- [[${o}]] — No inbound links`);
    lines.push("");
  }

  if (report.stalePages.length > 0) {
    lines.push("### Stale Pages");
    for (const s of report.stalePages) lines.push(`- [[${s.path}]] — Last updated ${s.lastUpdated}`);
    lines.push("");
  }

  if (report.missingPages.length > 0) {
    lines.push("### Missing Pages");
    for (const m of report.missingPages) lines.push(`- [[${m}]] — Referenced but not created`);
    lines.push("");
  }

  if (report.missingLinks.length > 0) {
    lines.push("### Cross-Reference Gaps");
    for (const ml of report.missingLinks) lines.push(`- [[${ml.from}]] mentions [[${ml.missing}]] but it doesn't exist`);
    lines.push("");
  }

  if (report.potentialConflicts.length > 0) {
    lines.push("### Potential Conflicts");
    for (const c of report.potentialConflicts) lines.push(`- [[${c.pageA}]] ↔ [[${c.pageB}]] — ${c.reason}`);
    lines.push("");
  }

  if (report.indexIssues.length > 0) {
    lines.push("### Index Issues");
    for (const i of report.indexIssues) lines.push(`- ${i}`);
    lines.push("");
  }

  if (lines.length === 2) {
    lines.push("No issues found. Wiki is healthy!");
  }

  const output = lines.join("\n");
  const saved = estimateWikiTokensSaved(projectDir, output);
  if (saved > 0) {
    recordMetric(projectDir, "wiki_lint", "wiki health check", saved);
  }

  return textResult(output);
}

export async function handleJudge(): Promise<CallToolResult> {
  const projectDir = getProjectDir();
  let index = loadIndex(projectDir);

  if (!index || isIndexStale(projectDir, index)) {
    buildAndSaveIndex(projectDir);
    index = loadIndex(projectDir);
  }

  if (!index) {
    return textResult("No wiki index found. Run `wiki-agent index` or `wiki-agent init` first.");
  }

  const conflicts = findPotentialConflicts(index);

  if (conflicts.length === 0) {
    const msg = "No potential conflicts detected.";
    const saved = estimateWikiTokensSaved(projectDir, msg);
    if (saved > 0) {
      recordMetric(projectDir, "wiki_judge", "conflict detection", saved);
    }
    return textResult(msg);
  }

  const output = conflicts
    .map((c) => `- [[${c.pageA}]] ↔ [[${c.pageB}]] — ${c.reason}`)
    .join("\n");

  const saved = estimateWikiTokensSaved(projectDir, output);
  if (saved > 0) {
    recordMetric(projectDir, "wiki_judge", "conflict detection", saved);
  }

  return textResult(`Potential conflicts found:\n\n${output}`);
}

export async function handleStatus(): Promise<CallToolResult> {
  const projectDir = getProjectDir();
  const status = getWikiStatus(projectDir);

  if (!status.exists) {
    return textResult("Wiki not found. Run `wiki-agent init` to create one.");
  }

  const lines = [
    `Wiki Status`,
    ``,
    `  Pages: ${status.totalPages}`,
  ];

  if (Object.keys(status.types).length > 0) {
    const typeSummary = Object.entries(status.types)
      .map(([type, count]) => `${type}(${count})`)
      .join(" ");
    lines.push(`  Types: ${typeSummary}`);
  }

  const indexStatus = status.indexStale
    ? "stale (run `wiki-agent index` to rebuild)"
    : status.lastIndex
      ? `up to date (built ${status.lastIndex})`
      : "not built";

  lines.push(`  Index: ${indexStatus}`);

  const output = lines.join("\n");
  const saved = estimateWikiTokensSaved(projectDir, output);
  if (saved > 0) {
    recordMetric(projectDir, "wiki_status", "status check", saved);
  }

  return textResult(output);
}

export async function handleStats(): Promise<CallToolResult> {
  const projectDir = getProjectDir();
  const { getMetrics } = await import("../core/metrics.js");
  const metrics = getMetrics(projectDir);

  if (metrics.totalOperations === 0) {
    return textResult("No metrics recorded yet. Use the wiki tools to start saving tokens!");
  }

  const lines = [
    `## Token Savings Report`,
    ``,
    `Total tokens saved: ${metrics.totalTokensSaved.toLocaleString()}`,
    `Total operations: ${metrics.totalOperations}`,
    ``,
    `### By Tool`,
  ];

  for (const [tool, data] of Object.entries(metrics.byTool)) {
    lines.push(`- ${tool}: ${data.count} ops, ${data.tokensSaved.toLocaleString()} tokens saved`);
  }

  if (metrics.recentEvents.length > 0) {
    lines.push("", "### Recent Events");
    for (const ev of metrics.recentEvents.slice(0, 10)) {
      lines.push(`- [${ev.tool}] ${ev.detail} — +${ev.saved.toLocaleString()} tokens`);
    }
  }

  return textResult(lines.join("\n"));
}
