import { resolve } from "node:path";
import * as clack from "@clack/prompts";
import { buildAndSaveIndex } from "../../core/wiki-ops.js";

export async function indexCommand(dir?: string): Promise<void> {
  const projectDir = dir ? resolve(dir) : process.cwd();

  const s = clack.spinner();
  s.start("Building search index...");

  const totalPages = buildAndSaveIndex(projectDir);

  s.stop(`Index built: ${totalPages} pages indexed`);
  clack.outro("");
}