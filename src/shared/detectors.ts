import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Harness } from "../core/types.js";

const HARNESS_DETECTORS: Record<Exclude<Harness, "cursor">, (projectDir: string) => boolean> = {
  opencode: (dir) =>
    existsSync(join(dir, "opencode.json")) ||
    existsSync(join(dir, "opencode.jsonc")) ||
    existsSync(join(dir, ".opencode")) ||
    existsSync(join(dir, ".opencode", "opencode.json")),
  "claude-code": (dir) =>
    existsSync(join(dir, "CLAUDE.md")) ||
    existsSync(join(dir, ".claude")),
  codex: (dir) =>
    existsSync(join(dir, "AGENTS.md")) && !existsSync(join(dir, ".opencode")),
};

export function detectHarnesses(projectDir: string): Harness[] {
  const detected: Harness[] = [];
  for (const [harness, detector] of Object.entries(HARNESS_DETECTORS)) {
    if (detector(projectDir)) {
      detected.push(harness as Harness);
    }
  }
  return detected;
}

export function getAllHarnesses(): Harness[] {
  return ["opencode", "claude-code", "codex", "cursor"];
}

export interface HarnessConfig {
  agentsDir: string;
  mainInstructions: string;
  configJson?: string;
}

export function getHarnessConfigPath(
  harness: Harness,
  projectDir: string,
): HarnessConfig {
  switch (harness) {
    case "opencode":
      return {
        agentsDir: join(projectDir, ".opencode", "agents"),
        mainInstructions: join(projectDir, "AGENTS.md"),
        configJson: join(projectDir, "opencode.json"),
      };
    case "claude-code":
      return {
        agentsDir: join(projectDir, ".claude", "agents"),
        mainInstructions: join(projectDir, "CLAUDE.md"),
      };
    case "codex":
      return {
        agentsDir: join(projectDir, ".codex", "agents"),
        mainInstructions: join(projectDir, "AGENTS.md"),
      };
    case "cursor":
      return {
        agentsDir: join(projectDir, ".cursor", "agents"),
        mainInstructions: join(projectDir, ".cursorrules"),
      };
  }
}