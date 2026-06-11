import { existsSync, readdirSync, rmdirSync, rmSync, statSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import * as clack from "@clack/prompts";
import { removeSection } from "../../shared/merger.js";
import { getAllHarnesses } from "../../shared/detectors.js";
import { WIKI_AGENTS } from "../../shared/generators/common.js";
import { withFileLock } from "../../core/lock.js";
import { writeFileAtomic } from "../../core/atomic-write.js";
import { VERSION } from "../../shared/version.js";

interface RemovalItem {
  type: "dir" | "file" | "section" | "json-keys";
  path: string;
  description: string;
}

function getRelativePath(projectDir: string, fullPath: string): string {
  const rel = relative(projectDir, fullPath);
  return rel.startsWith("..") ? fullPath : rel;
}

function isDirEmpty(dirPath: string): boolean {
  if (!existsSync(dirPath)) return true;
  const items = readdirSync(dirPath);
  return items.length === 0;
}

function collectLegacyItems(projectDir: string): RemovalItem[] {
  const items: RemovalItem[] = [];

  // 1. Wiki directories
  const wikiDir = join(projectDir, "wiki");
  if (existsSync(wikiDir)) {
    items.push({ type: "dir", path: wikiDir, description: "Wiki directory (agent-generated pages)" });
  }

  const wikiAgentDir = join(projectDir, ".wiki-agent");
  if (existsSync(wikiAgentDir)) {
    items.push({ type: "dir", path: wikiAgentDir, description: "BM25 search index directory" });
  }

  // 2. Raw directory (creado por wiki-agent)
  const rawDir = join(projectDir, "raw");
  if (existsSync(rawDir)) {
    items.push({ type: "dir", path: rawDir, description: "Raw directory (created by wiki-agent)" });
  }

  // 3. wiki-spec.md
  const specPath = join(projectDir, "wiki-spec.md");
  if (existsSync(specPath)) {
    items.push({ type: "file", path: specPath, description: "Framework-agnostic wiki specification" });
  }

  return items;
}

function collectMemoryItems(projectDir: string): RemovalItem[] {
  const items: RemovalItem[] = [];
  const memoryDir = join(projectDir, "memory");

  // 1. Wiki directories
  const wikiDir = join(memoryDir, "wiki");
  if (existsSync(wikiDir)) {
    items.push({ type: "dir", path: wikiDir, description: "Wiki directory (agent-generated pages)" });
  }

  const wikiAgentDir = join(memoryDir, ".wiki-agent");
  if (existsSync(wikiAgentDir)) {
    items.push({ type: "dir", path: wikiAgentDir, description: "BM25 search index directory" });
  }

  // 2. Raw directory
  const rawDir = join(memoryDir, "raw");
  if (existsSync(rawDir)) {
    items.push({ type: "dir", path: rawDir, description: "Raw directory (created by wiki-agent)" });
  }

  // 3. wiki-spec.md
  const specPath = join(memoryDir, "wiki-spec.md");
  if (existsSync(specPath)) {
    items.push({ type: "file", path: specPath, description: "Framework-agnostic wiki specification" });
  }

  return items;
}

export function collectItems(projectDir: string): RemovalItem[] {
  const items: RemovalItem[] = [];

  // Try new memory/ structure first
  const memoryItems = collectMemoryItems(projectDir);
  if (memoryItems.length > 0) {
    items.push(...memoryItems);
  } else {
    // Fallback to legacy root-level structure
    const legacyItems = collectLegacyItems(projectDir);
    if (legacyItems.length > 0) {
      console.warn("[wiki-agent] Using legacy wiki structure at project root. Run 'wiki-agent update' to migrate to memory/.");
      items.push(...legacyItems);
    }
  }

  // 4. Sub-agent files per harness
  const harnessDirs: Record<string, string> = {
    opencode: join(projectDir, ".opencode", "agents"),
    "claude-code": join(projectDir, ".claude", "agents"),
    codex: join(projectDir, ".codex", "agents"),
    cursor: join(projectDir, ".cursor", "agents"),
  };

  for (const [harness, agentsDir] of Object.entries(harnessDirs)) {
    if (!existsSync(agentsDir)) continue;
    for (const agentName of WIKI_AGENTS) {
      const agentFile = join(agentsDir, agentName + ".md");
      if (existsSync(agentFile)) {
        items.push({ type: "file", path: agentFile, description: `Sub-agent file for ${harness}` });
      }
    }
  }

  // 5. Instruction files with merged sections
  const instructionFiles = [
    { path: join(projectDir, "AGENTS.md"), name: "AGENTS.md" },
    { path: join(projectDir, "CLAUDE.md"), name: "CLAUDE.md" },
    { path: join(projectDir, ".cursorrules"), name: ".cursorrules" },
  ];

  for (const { path, name } of instructionFiles) {
    if (existsSync(path)) {
      const content = readFileSync(path, "utf-8");
      if (content.includes("<!-- WIKI-AGENT:START -->") && content.includes("<!-- WIKI-AGENT:END -->")) {
        items.push({ type: "section", path, description: `Wiki-Agent section inside ${name}` });
      }
    }
  }

  // 6. opencode.json wiki-agent keys
  const opencodeJsonPath = join(projectDir, "opencode.json");
  if (existsSync(opencodeJsonPath)) {
    const content = readFileSync(opencodeJsonPath, "utf-8");
    try {
      const json = JSON.parse(content) as Record<string, unknown>;
      const hasWikiAgentKeys =
        json.mcp && typeof json.mcp === "object" && "wiki-agent" in (json.mcp as Record<string, unknown>);
      if (hasWikiAgentKeys) {
        items.push({ type: "json-keys", path: opencodeJsonPath, description: "Wiki-Agent entries in opencode.json" });
      }
    } catch {
      // invalid JSON, skip
    }
  }

  return items;
}

export function cleanWikiAgentFromJson(obj: Record<string, unknown>): Record<string, unknown> {
  const result = { ...obj };

  // Remove mcp.wiki-agent
  if (result.mcp && typeof result.mcp === "object" && !Array.isArray(result.mcp)) {
    const mcp = { ...(result.mcp as Record<string, unknown>) };
    delete mcp["wiki-agent"];
    if (Object.keys(mcp).length === 0) {
      delete result.mcp;
    } else {
      result.mcp = mcp;
    }
  }

  return result;
}

function removeAgentDirsIfEmpty(projectDir: string): void {
  const harnessDirs = [
    join(projectDir, ".opencode", "agents"),
    join(projectDir, ".claude", "agents"),
    join(projectDir, ".codex", "agents"),
    join(projectDir, ".cursor", "agents"),
  ];

  for (const dir of harnessDirs) {
    if (existsSync(dir) && isDirEmpty(dir)) {
      rmdirSync(dir);
      // Also remove parent if it becomes empty (e.g. .opencode/)
      const parent = join(dir, "..");
      if (existsSync(parent) && isDirEmpty(parent)) {
        rmdirSync(parent);
      }
    }
  }
}

function removeMemoryIfEmpty(projectDir: string): void {
  const memoryDir = join(projectDir, "memory");
  if (!existsSync(memoryDir)) return;

  const SYSTEM_FILES = [".DS_Store", ".localized"];
  const items = readdirSync(memoryDir);

  const hasOnlySystemFiles = items.every((item) => SYSTEM_FILES.includes(item));

  if (hasOnlySystemFiles || items.length === 0) {
    // Remove system files first, then the directory
    for (const file of items) {
      rmSync(join(memoryDir, file), { force: true });
    }
    rmdirSync(memoryDir);
  }
}

export async function removeCommand(projectDir: string, force = false): Promise<void> {
  clack.intro(`Wiki-Agent v${VERSION}`);

  const items = collectItems(projectDir);

  if (items.length === 0) {
    clack.outro("No wiki-agent files found. Nothing to remove.");
    return;
  }

  console.log("\nThe following wiki-agent items will be removed:\n");
  for (const item of items) {
    const rel = getRelativePath(projectDir, item.path);
    console.log("  " + (item.type === "section" || item.type === "json-keys" ? "~ " : "- ") + rel);
    console.log("    " + item.description);
  }
  console.log("");

  let confirmed = force;
  if (!confirmed) {
    const answer = await clack.confirm({
      message: "Are you sure you want to remove all wiki-agent data?",
      initialValue: false,
    });

    if (clack.isCancel(answer)) {
      clack.cancel("Cancelled");
      process.exit(0);
    }

    confirmed = answer as boolean;
  }

  if (!confirmed) {
    clack.cancel("Removal cancelled");
    process.exit(0);
  }

  const s = clack.spinner();
  s.start("Removing wiki-agent files...");

  const removed: string[] = [];
  const modified: string[] = [];

  // Remove files/sections/json-keys first, then directories.
  // This ensures withFileLock can still find the project root via memory/.wiki-agent
  // before the marker directories are deleted.
  const nonDirs = items.filter((i) => i.type !== "dir");
  const dirs = items.filter((i) => i.type === "dir");

  for (const item of nonDirs) {
    if (item.type === "file") {
      rmSync(item.path, { force: true });
      removed.push(getRelativePath(projectDir, item.path));
    } else if (item.type === "section") {
      const hadSection = removeSection(item.path);
      if (hadSection) {
        modified.push(getRelativePath(projectDir, item.path));
        // If file became empty after section removal, remove it entirely
        if (existsSync(item.path)) {
          const remaining = readFileSync(item.path, "utf-8").trim();
          if (remaining.length === 0) {
            rmSync(item.path, { force: true });
            removed.push(getRelativePath(projectDir, item.path) + " (empty after cleanup)");
          }
        }
      }
    } else if (item.type === "json-keys") {
      withFileLock(item.path, () => {
        const content = readFileSync(item.path, "utf-8");
        const json = JSON.parse(content) as Record<string, unknown>;
        const cleaned = cleanWikiAgentFromJson(json);
        writeFileAtomic(item.path, JSON.stringify(cleaned, null, 2) + "\n");
        modified.push(getRelativePath(projectDir, item.path));
      });
    }
  }

  for (const item of dirs) {
    rmSync(item.path, { recursive: true, force: true });
    removed.push(getRelativePath(projectDir, item.path));
  }

  // Cleanup empty agent directories and memory/
  removeAgentDirsIfEmpty(projectDir);
  removeMemoryIfEmpty(projectDir);

  s.stop("Removal complete");

  for (const r of removed) {
    clack.log.success("Removed: " + r);
  }
  for (const m of modified) {
    clack.log.success("Cleaned: " + m);
  }

  clack.outro("Wiki-Agent has been removed from this project.");
}
