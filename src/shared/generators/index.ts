import type { Harness } from "../../core/types.js";
import { generateSubagentsForOpenCode } from "./opencode.js";
import { generateSubagentsForClaudeCode } from "./claude-code.js";
import { generateSubagentsForCodex } from "./codex.js";
import { generateSubagentsForCursor } from "./cursor.js";

export function generateSubagentsForHarness(
  harness: Harness,
  projectDir: string,
  templates: Map<string, string>,
  wikiSection: string,
  actions: string[],
  warnings: string[],
  force = false,
): void {
  switch (harness) {
    case "opencode":
      generateSubagentsForOpenCode(projectDir, templates, wikiSection, actions, warnings, force);
      break;
    case "claude-code":
      generateSubagentsForClaudeCode(projectDir, templates, wikiSection, actions, warnings, force);
      break;
    case "codex":
      generateSubagentsForCodex(projectDir, templates, wikiSection, actions, warnings, force);
      break;
    case "cursor":
      generateSubagentsForCursor(projectDir, templates, wikiSection, actions, warnings, force);
      break;
  }
}
