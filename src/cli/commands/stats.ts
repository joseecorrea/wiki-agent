import { resolve } from "node:path";
import * as clack from "@clack/prompts";
import { getMetrics } from "../../core/metrics.js";
import { getWikiStatus } from "../../core/wiki-ops.js";

export async function statsCommand(dir?: string): Promise<void> {
  const projectDir = dir ? resolve(dir) : process.cwd();

  const status = getWikiStatus(projectDir);
  if (!status.exists) {
    clack.log.error("Wiki not found. Run wiki-agent init first.");
    process.exit(1);
  }

  const metrics = getMetrics(projectDir);

  clack.intro("Wiki-Agent Token Savings");

  if (metrics.totalOperations === 0) {
    clack.log.info("No metrics recorded yet.");
    clack.log.info("Use the wiki tools to start saving tokens!");
    clack.outro("");
    return;
  }

  clack.log.info(`Total tokens saved: ${metrics.totalTokensSaved.toLocaleString()}`);
  clack.log.info(`Total operations: ${metrics.totalOperations}`);

  if (Object.keys(metrics.byTool).length > 0) {
    console.log("");
    console.log("By Tool:");
    for (const [tool, data] of Object.entries(metrics.byTool)) {
      clack.log.step(`${tool}: ${data.count} ops, ${data.tokensSaved.toLocaleString()} tokens saved`);
    }
  }

  if (metrics.recentEvents.length > 0) {
    console.log("");
    console.log("Recent Events:");
    for (const ev of metrics.recentEvents.slice(0, 10)) {
      clack.log.step(`[${ev.tool}] ${ev.detail} — +${ev.saved.toLocaleString()} tokens`);
    }
  }

  clack.outro("");
}
