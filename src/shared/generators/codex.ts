import { join } from "node:path";
import { mergeIntoFile } from "../merger.js";
import {
  createWikiStructure,
  createAgentFiles,
  createWikiSpec,
  type GenerateResult,
} from "./common.js";

export function generateSubagentsForCodex(
  projectDir: string,
  templates: Map<string, string>,
  wikiSection: string,
  actions: string[],
  warnings: string[],
): void {
  const agentsDir = join(projectDir, ".codex", "agents");
  createAgentFiles(projectDir, agentsDir, templates, actions, warnings);

  const agentsMdPath = join(projectDir, "AGENTS.md");
  const result = mergeIntoFile(agentsMdPath, wikiSection.trim());
  switch (result) {
    case "created":
      actions.push("Created AGENTS.md with wiki-agent section");
      break;
    case "inserted":
      actions.push("Appended wiki-agent section to existing AGENTS.md");
      break;
    case "replaced":
      actions.push("Updated wiki-agent section in AGENTS.md");
      break;
  }
}

export function generateForCodex(
  projectDir: string,
  templates: Map<string, string>,
  wikiSpec: string,
  wikiSection: string,
): GenerateResult {
  const actions: string[] = [];
  const warnings: string[] = [];

  createWikiStructure(projectDir, actions, warnings);
  generateSubagentsForCodex(projectDir, templates, wikiSection, actions, warnings);
  createWikiSpec(projectDir, wikiSpec, actions);

  return { actions, warnings };
}
