import { resolve } from "node:path";
import * as clack from "@clack/prompts";
import { searchWiki } from "../../core/wiki-ops.js";

export async function searchCommand(query: string, dir?: string, options?: { type?: string; confidence?: string; tags?: string[] }): Promise<void> {
  const projectDir = dir ? resolve(dir) : process.cwd();

  const results = searchWiki(projectDir, query, options);

  if (results.length === 0) {
    clack.log.warn("No results found.");
    return;
  }

  clack.intro(`Search: "${query}"`);

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    clack.log.step(`${i + 1}. [[${r.title}]] (${r.score}) ${r.type} | ${r.confidence}`);
    if (r.excerpt) {
      console.log(`   ${r.excerpt.slice(0, 120)}${r.excerpt.length > 120 ? "..." : ""}`);
    }
  }

  clack.outro(`${results.length} result${results.length === 1 ? "" : "s"}`);
}