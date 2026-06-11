import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { mergeIntoFile, mergeIntoJson } from "../merger.js";
import {
  WIKI_AGENTS,
  createWikiStructure,
  createAgentFiles,
  createWikiSpec,
  type GenerateResult,
} from "./common.js";

export function generateSubagentsForOpenCode(
  projectDir: string,
  templates: Map<string, string>,
  wikiSection: string,
  actions: string[],
  warnings: string[],
  force = false,
): void {
  const agentsDir = join(projectDir, ".opencode", "agents");
  createAgentFiles(projectDir, agentsDir, templates, actions, warnings, force);

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

  const opencodeJsonPath = join(projectDir, "opencode.json");
  if (existsSync(opencodeJsonPath)) {
    const agentConfig = buildAgentConfig();
    mergeIntoJson(opencodeJsonPath, agentConfig);
    actions.push("Updated opencode.json with wiki-agent definitions and MCP server");
  } else {
    const config = buildFullConfig();
    writeFileSync(
      opencodeJsonPath,
      JSON.stringify(config, null, 2) + "\n",
      "utf-8",
    );
    actions.push("Created opencode.json with wiki-agent configuration and MCP server");
  }
}

export function generateForOpenCode(
  projectDir: string,
  templates: Map<string, string>,
  wikiSpec: string,
  wikiSection: string,
): GenerateResult {
  const actions: string[] = [];
  const warnings: string[] = [];

  createWikiStructure(projectDir, actions, warnings);
  generateSubagentsForOpenCode(projectDir, templates, wikiSection, actions, warnings);
  createWikiSpec(projectDir, wikiSpec, actions);

  return { actions, warnings };
}

function buildAgentConfig(): Record<string, unknown> {
  return {
    mcp: {
      "wiki-agent": {
        type: "local",
        command: ["npx", "-y", "wiki-agent-mcp"],
        enabled: true,
      },
    },
    permission: {
      task: {
        "wiki-*": "allow",
      },
    },
  };
}

function buildFullConfig(): Record<string, unknown> {
  return {
    $schema: "https://opencode.ai/config.json",
    instructions: ["AGENTS.md"],
    mcp: {
      "wiki-agent": {
        type: "local",
        command: ["npx", "-y", "wiki-agent-mcp"],
        enabled: true,
      },
    },
    permission: {
      task: {
        "wiki-*": "allow",
      },
    },
  };
}

export { WIKI_AGENTS };
