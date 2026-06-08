import { resolve } from "node:path";
import * as clack from "@clack/prompts";
import { detectHarnesses, getAllHarnesses } from "../../shared/detectors.js";
import { generateSubagentsForHarness } from "../../shared/generators/index.js";
import { createWikiStructure, createWikiSpec } from "../../shared/generators/common.js";
import { TEMPLATES, WIKI_SPEC, WIKI_SECTION } from "../../shared/templates.js";
import { needsMigration, hasMemoryWiki } from "../../core/migrate.js";
import { VERSION } from "../../shared/version.js";
import type { Harness } from "../../core/types.js";

const HARNESS_LABELS: Record<Harness, string> = {
  opencode: "OpenCode",
  "claude-code": "Claude Code",
  codex: "Codex",
  cursor: "Cursor",
};

export async function initCommand(projectDir: string, harnessFlag?: string): Promise<void> {
  clack.intro(`Wiki-Agent v${VERSION}`);

  // Check for existing wiki
  if (hasMemoryWiki(projectDir)) {
    clack.outro("Wiki already initialized.\n\n  Wiki: " + resolve(projectDir, "memory/wiki") + "\n\n  Use 'wiki-agent update' to migrate legacy structures, or 'wiki-agent add-harness' to add sub-agents.");
    return;
  }

  if (needsMigration(projectDir)) {
    clack.outro("Legacy wiki structure detected at project root.\n\n  Run 'wiki-agent update' to migrate into memory/.");
    process.exit(1);
  }

  const s = clack.spinner();
  s.start("Scanning project for agent harnesses...");

  const detected = detectHarnesses(projectDir);
  s.stop(detected.length > 0 ? detected.map((h) => HARNESS_LABELS[h]).join(", ") + " detected" : "No harness detected");

  // Step 1: Create base wiki structure (common to all harnesses)
  s.start("Creating wiki structure...");
  const actions: string[] = [];
  const warnings: string[] = [];
  const templates = new Map(Object.entries(TEMPLATES));

  createWikiStructure(projectDir, actions, warnings);
  createWikiSpec(projectDir, WIKI_SPEC, actions);
  s.stop("Wiki structure created");

  for (const action of actions) {
    clack.log.success(action);
  }
  for (const warning of warnings) {
    clack.log.warn(warning);
  }

  // Step 2: Ask which harnesses to create sub-agents for
  let selectedHarnesses: Harness[];

  if (harnessFlag) {
    selectedHarnesses = [harnessFlag as Harness];
    clack.log.success("Harness specified: " + HARNESS_LABELS[harnessFlag as Harness]);
  } else if (detected.length === 1) {
    const confirm = await clack.confirm({
      message: "Create wiki sub-agents for " + HARNESS_LABELS[detected[0]] + "?",
      initialValue: true,
    });

    if (clack.isCancel(confirm)) {
      clack.cancel("Cancelled");
      process.exit(0);
    }

    selectedHarnesses = confirm ? detected : [];
  } else if (detected.length === 0) {
    const allHarnesses = getAllHarnesses();
    const options = allHarnesses.map((h) => ({
      value: h as string,
      label: HARNESS_LABELS[h],
    }));

    const selection = await clack.multiselect({
      message: "Select harnesses to create wiki sub-agents for",
      options,
      required: false,
    });

    if (clack.isCancel(selection)) {
      clack.cancel("Cancelled");
      process.exit(0);
    }

    selectedHarnesses = (selection as string[]).map((s) => s as Harness);
  } else {
    const allHarnesses = getAllHarnesses();
    const options = allHarnesses.map((h) => ({
      value: h as string,
      label: HARNESS_LABELS[h] + (detected.includes(h) ? " (detected)" : ""),
      hint: detected.includes(h) ? "Found in project" : undefined,
    }));

    const selection = await clack.multiselect({
      message: "Select harnesses to create wiki sub-agents for",
      options,
      initialValues: detected,
      required: false,
    });

    if (clack.isCancel(selection)) {
      clack.cancel("Cancelled");
      process.exit(0);
    }

    selectedHarnesses = (selection as string[]).map((s) => s as Harness);
  }

  if (selectedHarnesses.length === 0) {
    clack.outro("Wiki initialized without sub-agents.\n\n  Wiki: " + resolve(projectDir, "wiki") + "\n\n  You can add sub-agents later with: wiki-agent add-harness <harness>");
    return;
  }

  s.start("Creating sub-agents...");

  const subActions: string[] = [];
  const subWarnings: string[] = [];

  for (const harness of selectedHarnesses) {
    generateSubagentsForHarness(
      harness,
      projectDir,
      templates,
      WIKI_SECTION,
      subActions,
      subWarnings,
    );
  }

  s.stop("Sub-agents created");

  for (const action of subActions) {
    clack.log.success(action);
  }
  for (const warning of subWarnings) {
    clack.log.warn(warning);
  }

  const harnessList = selectedHarnesses.map((h) => HARNESS_LABELS[h]).join(", ");

  clack.outro("Wiki initialized!\n\n  Wiki:     " + resolve(projectDir, "wiki") + "\n  Harness:  " + harnessList + "\n\n  Try: @wiki-search \"how does auth work?\"");
}
