import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const WIKI_AGENTS = [
  "wiki-search",
  "wiki-ingest",
  "wiki-update",
  "wiki-auto-learn",
  "wiki-lint",
] as const;

export const WIKI_DIRS = ["wiki/pages", "raw/assets"];

export const WIKI_INITIAL_FILES: Record<string, string> = {
  "wiki/index.md": `# Wiki Index

## Entities
<!-- List entity pages here as they are created -->

## Concepts
<!-- List concept pages here as they are created -->

## Decisions
<!-- List decision pages here as they are created -->

## Patterns
<!-- List pattern pages here as they are created -->

## Gotchas
<!-- List gotcha pages here as they are created -->

## Sources
<!-- List ingested sources here -->
`,
  "wiki/log.md": `# Wiki Log

<!-- Entries are appended chronologically. Format: ## [YYYY-MM-DD] operation | Title -->
`,
  "wiki/overview.md": `# Project Overview

<!-- This page is maintained by wiki-ingest and wiki-auto-learn. It captures the current synthesis of the project. -->

## Summary
<!-- A 2-4 paragraph summary will be built here as the wiki grows. -->

## Key Architecture
<!-- Important architectural decisions and patterns will be listed here. -->

## Active Areas
<!-- Currently active areas of investigation or development. -->
`,
};

export const AGENT_DESCRIPTIONS: Record<string, string> = {
  "wiki-search":
    "Search the project wiki for relevant context. Use when you need project knowledge, architecture details, or conventions.",
  "wiki-ingest":
    "Ingest a new source document into the wiki. Use when processing a document to integrate into the knowledge base.",
  "wiki-update":
    "Update specific wiki pages with new information. Use when modifying or extending existing wiki content.",
  "wiki-auto-learn":
    "Detect undocumented information and integrate it into the wiki. Use when you discover knowledge NOT in the wiki.",
  "wiki-lint":
    "Health-check the wiki for orphans, contradictions, stale content, and missing cross-references.",
};

export interface GenerateResult {
  actions: string[];
  warnings: string[];
}

export function createWikiStructure(
  projectDir: string,
  actions: string[],
  warnings: string[],
): void {
  for (const dir of WIKI_DIRS) {
    const fullPath = join(projectDir, dir);
    if (!existsSync(fullPath)) {
      mkdirSync(fullPath, { recursive: true });
      actions.push("Created directory: " + dir + "/");
    } else {
      actions.push("Directory already exists: " + dir + "/");
    }
  }

  const indexDir = join(projectDir, ".wiki-agent");
  if (!existsSync(indexDir)) {
    mkdirSync(indexDir, { recursive: true });
    actions.push("Created directory: .wiki-agent/");
  }

  for (const [filePath, content] of Object.entries(WIKI_INITIAL_FILES)) {
    const fullPath = join(projectDir, filePath);
    if (!existsSync(fullPath)) {
      writeFileSync(fullPath, content, "utf-8");
      actions.push("Created file: " + filePath);
    } else {
      actions.push("File already exists, skipped: " + filePath);
    }
  }
}

export function createAgentFiles(
  projectDir: string,
  agentsDir: string,
  templates: Map<string, string>,
  actions: string[],
  warnings: string[],
): void {
  if (!existsSync(agentsDir)) {
    mkdirSync(agentsDir, { recursive: true });
  }

  const relativeAgentsDir = agentsDir.replace(projectDir + "/", "");

  for (const agentName of WIKI_AGENTS) {
    const destPath = join(agentsDir, agentName + ".md");
    if (!existsSync(destPath)) {
      const template = templates.get(agentName);
      if (template) {
        writeFileSync(destPath, template, "utf-8");
        actions.push("Created sub-agent: " + relativeAgentsDir + "/" + agentName + ".md");
      } else {
        warnings.push(
          "Template not found for " + agentName + ". Agent file needs to be created manually.",
        );
      }
    } else {
      actions.push(
        "Sub-agent already exists, skipped: " + relativeAgentsDir + "/" + agentName + ".md",
      );
    }
  }
}

export function createWikiSpec(
  projectDir: string,
  wikiSpec: string,
  actions: string[],
): void {
  const specDest = join(projectDir, "wiki-spec.md");
  if (!existsSync(specDest)) {
    writeFileSync(specDest, wikiSpec, "utf-8");
    actions.push("Created wiki-spec.md (framework-agnostic specification)");
  } else {
    actions.push("wiki-spec.md already exists, skipped");
  }
}
