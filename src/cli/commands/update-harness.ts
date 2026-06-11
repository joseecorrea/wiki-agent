import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import * as clack from "@clack/prompts";
import { getAllHarnesses, getHarnessConfigPath } from "../../shared/detectors.js";
import { generateSubagentsForHarness } from "../../shared/generators/index.js";
import { TEMPLATES, WIKI_SECTION } from "../../shared/templates.js";
import { getWikiDir } from "../../core/utils.js";
import { WIKI_AGENTS } from "../../shared/generators/common.js";
import { VERSION } from "../../shared/version.js";
import type { Harness } from "../../core/types.js";

const HARNESS_LABELS: Record<Harness, string> = {
  opencode: "OpenCode",
  "claude-code": "Claude Code",
  codex: "Codex",
  cursor: "Cursor",
};

function detectInitializedHarnesses(projectDir: string): Harness[] {
  const initialized: Harness[] = [];
  for (const harness of getAllHarnesses()) {
    const { agentsDir } = getHarnessConfigPath(harness, projectDir);
    const hasAnyAgent = WIKI_AGENTS.some((agent) =>
      existsSync(join(agentsDir, agent + ".md")),
    );
    if (hasAnyAgent) {
      initialized.push(harness);
    }
  }
  return initialized;
}

export async function updateHarnessCommand(projectDir: string, harnessArg?: string): Promise<void> {
  clack.intro(`Wiki-Agent v${VERSION}`);

  if (!existsSync(getWikiDir(projectDir))) {
    clack.log.error("No wiki found. Run 'wiki-agent init' first.");
    process.exit(1);
  }

  const initialized = detectInitializedHarnesses(projectDir);

  if (initialized.length === 0) {
    clack.outro("No harnesses initialized.\n\n  Run 'wiki-agent add-harness <harness>' to add sub-agents.");
    return;
  }

  let selectedHarness: Harness;

  if (harnessArg) {
    selectedHarness = harnessArg as Harness;
    if (!initialized.includes(selectedHarness)) {
      clack.log.error("Harness '" + HARNESS_LABELS[selectedHarness] + "' is not initialized.");
      process.exit(1);
    }
    clack.log.success("Harness specified: " + HARNESS_LABELS[selectedHarness]);
  } else if (initialized.length === 1) {
    const confirm = await clack.confirm({
      message: "Update wiki sub-agents for " + HARNESS_LABELS[initialized[0]] + "?",
      initialValue: true,
    });

    if (clack.isCancel(confirm)) {
      clack.cancel("Cancelled");
      process.exit(0);
    }

    if (!confirm) {
      clack.outro("No harness updated.");
      return;
    }

    selectedHarness = initialized[0];
  } else {
    const options = initialized.map((h) => ({
      value: h as string,
      label: HARNESS_LABELS[h],
    }));

    const selection = await clack.select({
      message: "Select a harness to update wiki sub-agents for",
      options,
    });

    if (clack.isCancel(selection)) {
      clack.cancel("Cancelled");
      process.exit(0);
    }

    selectedHarness = selection as Harness;
  }

  const s = clack.spinner();
  s.start("Updating sub-agents for " + HARNESS_LABELS[selectedHarness] + "...");

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
    true,
  );

  s.stop("Sub-agents updated");

  for (const action of actions) {
    clack.log.success(action);
  }
  for (const warning of warnings) {
    clack.log.warn(warning);
  }

  clack.outro("Wiki sub-agents updated for " + HARNESS_LABELS[selectedHarness] + "!\n\n  Wiki: " + resolve(projectDir, "memory/wiki") + "\n\n  Try: @wiki-search \"how does auth work?\"");
}
