import { resolve } from "node:path";
import * as clack from "@clack/prompts";
import { buildAndSaveIndex, updateAndSaveIndex } from "../../core/wiki-ops.js";
import { hasMemoryWiki, needsMigration } from "../../core/migrate.js";

export async function indexCommand(dir?: string, force?: boolean): Promise<void> {
  const projectDir = dir ? resolve(dir) : process.cwd();

  if (!hasMemoryWiki(projectDir) && needsMigration(projectDir)) {
    console.warn("[wiki-agent] Using legacy wiki structure at project root. Run 'wiki-agent update' to migrate to memory/.");
  }

  const s = clack.spinner();

  if (force) {
    s.start("Rebuilding search index...");
    const totalPages = buildAndSaveIndex(projectDir);
    s.stop(`Index rebuilt: ${totalPages} pages indexed`);
  } else {
    s.start("Updating search index...");
    const result = updateAndSaveIndex(projectDir);
    if (result.changed) {
      s.stop(`Index updated: ${result.totalPages} pages indexed`);
    } else {
      s.stop(`Index up to date: ${result.totalPages} pages indexed`);
    }
  }
  clack.outro("");
}
