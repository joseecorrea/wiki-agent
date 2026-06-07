import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import * as clack from "@clack/prompts";
import { getAllHarnesses } from "../../shared/detectors.js";
import { generateSubagentsForHarness } from "../../shared/generators/index.js";
import { TEMPLATES, WIKI_SECTION } from "../../shared/templates.js";
import type { Harness } from "../../core/types.js";

const HARNESS_LABELS: Record<Harness, string> = {
  opencode: "OpenCode",
  "claude-code": "Claude Code",
  codex: "Codex",
  cursor: "Cursor",
};

export async function addHarnessCommand(projectDir: string, harnessArg?: string): Promise<void> {
  clack.intro("Wiki-Agent v0.2.0");

  if (!existsSync(join(projectDir, "wiki"))) {
    clack.log.error("No wiki found. Run 'wiki-agent init' first.");
    process.exit(1);
  }

  let selectedHarness: Harness;

  if (harnessArg) {
    selectedHarness = harnessArg as Harness;
    clack.log.success("Harness specified: " + HARNESS_LABELS[selectedHarness]);
  } else {
    const allHarnesses = getAllHarnesses();
    const options = allHarnesses.map((h) => ({
      value: h as string,
      label: HARNESS_LABELS[h],
    }));

    const selection = await clack.select({
      message: "Select a harness to add wiki sub-agents for",
      options,
    });

    if (clack.isCancel(selection)) {
      clack.cancel("Cancelled");
      process.exit(0);
    }

    selectedHarness = selection as Harness;
  }

  const s = clack.spinner();
  s.start("Creating sub-agents for " + HARNESS_LABELS[selectedHarness] + "...");

  const actions: string[] = [];
  const warnings: string[] = [];
  const templates = new Map(Object.entries(TEMPLATES));

  generateSubagentsForHarness(
    selectedHarness,
    projectDir,
    templates,
    WIKI_SECTION,
    actions,
    warnings,
  );

  s.stop("Sub-agents created");

  for (const action of actions) {
    clack.log.success(action);
  }
  for (const warning of warnings) {
    clack.log.warn(warning);
  }

  clack.outro("Wiki sub-agents added for " + HARNESS_LABELS[selectedHarness] + "!\n\n  Wiki: " + resolve(projectDir, "wiki") + "\n\n  Try: @wiki-search \"how does auth work?\"");
}
