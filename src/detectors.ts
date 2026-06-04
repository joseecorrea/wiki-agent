import { existsSync } from "node:fs";
import { join } from "node:path";

export type Harness = "opencode" | "claude-code" | "codex";

const HARNESS_DETECTORS: Record<Harness, (projectDir: string) => boolean> = {
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

export function detectHarness(projectDir: string): Harness | null {
  for (const [harness, detector] of Object.entries(HARNESS_DETECTORS)) {
    if (detector(projectDir)) {
      return harness as Harness;
    }
  }
  return null;
}

export function getHarnessConfigPath(
  harness: Harness,
  projectDir: string,
): {
  agentsDir: string;
  mainInstructions: string;
  configJson?: string;
} {
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
  }
}