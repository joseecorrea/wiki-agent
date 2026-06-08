import { resolve } from "node:path";
import * as clack from "@clack/prompts";
import { buildAndSaveIndex } from "../../core/wiki-ops.js";
import { hasMemoryWiki, needsMigration } from "../../core/migrate.js";

export async function indexCommand(dir?: string): Promise<void> {
  const projectDir = dir ? resolve(dir) : process.cwd();

  if (!hasMemoryWiki(projectDir) && needsMigration(projectDir)) {
    console.warn("[wiki-agent] Using legacy wiki structure at project root. Run 'wiki-agent update' to migrate to memory/.");
  }

  const s = clack.spinner();
  s.start("Building search index...");

  const totalPages = buildAndSaveIndex(projectDir);

  s.stop(`Index built: ${totalPages} pages indexed`);
  clack.outro("");
}