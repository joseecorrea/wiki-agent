import { join } from "node:path";
import { mergeIntoFile } from "../merger.js";
import {
  createWikiStructure,
  createAgentFiles,
  createWikiSpec,
  type GenerateResult,
} from "./common.js";

export function generateSubagentsForClaudeCode(
  projectDir: string,
  templates: Map<string, string>,
  wikiSection: string,
  actions: string[],
  warnings: string[],
  force = false,
): void {
  const agentsDir = join(projectDir, ".claude", "agents");
  createAgentFiles(projectDir, agentsDir, templates, actions, warnings, force);

  const claudeMdPath = join(projectDir, "CLAUDE.md");
  const result = mergeIntoFile(claudeMdPath, wikiSection.trim());
  switch (result) {
    case "created":
      actions.push("Created CLAUDE.md with wiki-agent section");
      break;
    case "inserted":
      actions.push("Appended wiki-agent section to existing CLAUDE.md");
      break;
    case "replaced":
      actions.push("Updated wiki-agent section in CLAUDE.md");
      break;
  }
}

export function generateForClaudeCode(
  projectDir: string,
  templates: Map<string, string>,
  wikiSpec: string,
  wikiSection: string,
): GenerateResult {
  const actions: string[] = [];
  const warnings: string[] = [];

  createWikiStructure(projectDir, actions, warnings);
  generateSubagentsForClaudeCode(projectDir, templates, wikiSection, actions, warnings);
  createWikiSpec(projectDir, wikiSpec, actions);

  return { actions, warnings };
}
