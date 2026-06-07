import { join } from "node:path";
import { mergeIntoFile } from "../merger.js";
import {
  createWikiStructure,
  createAgentFiles,
  createWikiSpec,
  type GenerateResult,
} from "./common.js";

export function generateSubagentsForCursor(
  projectDir: string,
  templates: Map<string, string>,
  wikiSection: string,
  actions: string[],
  warnings: string[],
): void {
  const agentsDir = join(projectDir, ".cursor", "agents");
  createAgentFiles(projectDir, agentsDir, templates, actions, warnings);

  const cursorRulesPath = join(projectDir, ".cursorrules");
  const result = mergeIntoFile(cursorRulesPath, wikiSection.trim());
  switch (result) {
    case "created":
      actions.push("Created .cursorrules with wiki-agent section");
      break;
    case "inserted":
      actions.push("Appended wiki-agent section to existing .cursorrules");
      break;
    case "replaced":
      actions.push("Updated wiki-agent section in .cursorrules");
      break;
  }
}

export function generateForCursor(
  projectDir: string,
  templates: Map<string, string>,
  wikiSpec: string,
  wikiSection: string,
): GenerateResult {
  const actions: string[] = [];
  const warnings: string[] = [];

  createWikiStructure(projectDir, actions, warnings);
  generateSubagentsForCursor(projectDir, templates, wikiSection, actions, warnings);
  createWikiSpec(projectDir, wikiSpec, actions);

  return { actions, warnings };
}
