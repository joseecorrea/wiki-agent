import { resolve } from "node:path";
import * as clack from "@clack/prompts";
import { getWikiStatus } from "../../core/wiki-ops.js";
import { getWikiDir, hasMemoryWiki } from "../../core/migrate.js";
import { recordMetric, estimateWikiTokensSaved } from "../../core/metrics.js";

export async function statusCommand(dir?: string): Promise<void> {
  const projectDir = dir ? resolve(dir) : process.cwd();

  const status = getWikiStatus(projectDir);

  if (!status.exists) {
    clack.log.error("Wiki not found. Run wiki-agent init first.");
    process.exit(1);
  }

  clack.intro("Wiki-Agent Status");

  const staleMsg = "stale (run wiki-agent index to rebuild)";
  const upToDateMsg = status.lastIndex
    ? "up to date (built " + status.lastIndex + ")"
    : "not built";
  const indexStatus = status.indexStale ? staleMsg : upToDateMsg;

  const wikiPath = hasMemoryWiki(projectDir)
    ? resolve(projectDir, "memory/wiki")
    : resolve(projectDir, "wiki");

  if (!hasMemoryWiki(projectDir)) {
    console.warn("[wiki-agent] Using legacy wiki structure at project root. Run 'wiki-agent update' to migrate to memory/.");
  }

  const outputLines = [
    "Wiki: " + wikiPath,
    "Index: " + indexStatus,
    "Pages: " + String(status.totalPages),
  ];

  if (Object.keys(status.types).length > 0) {
    const typeSummary = Object.entries(status.types)
      .map(([type, count]) => type + "(" + String(count) + ")")
      .join(" ");
    outputLines.push("Types: " + typeSummary);
  }

  const outputText = outputLines.join("\n");
  const saved = estimateWikiTokensSaved(projectDir, outputText);
  if (saved > 0) {
    recordMetric(projectDir, "wiki_status", "status check", saved);
  }

  clack.log.info("Wiki: " + wikiPath);
  clack.log.info("Index: " + indexStatus);
  clack.log.info("Pages: " + String(status.totalPages));

  if (Object.keys(status.types).length > 0) {
    const typeSummary = Object.entries(status.types)
      .map(([type, count]) => type + "(" + String(count) + ")")
      .join(" ");
    clack.log.info("Types: " + typeSummary);
  }

  clack.outro("");
}