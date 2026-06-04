import { resolve } from "node:path";
import * as clack from "@clack/prompts";
import { getWikiStatus } from "../../core/wiki-ops.js";

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

  clack.log.info("Wiki: " + resolve(projectDir, "wiki"));
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