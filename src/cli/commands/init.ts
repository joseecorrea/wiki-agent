import { resolve } from "node:path";
import * as clack from "@clack/prompts";
import { detectHarnesses, getAllHarnesses } from "../../shared/detectors.js";
import { generateForOpenCode } from "../../shared/generators/opencode.js";
import { TEMPLATES, WIKI_SPEC, WIKI_SECTION } from "../../shared/templates.js";
import type { Harness } from "../../core/types.js";

const HARNESS_LABELS: Record<Harness, string> = {
  opencode: "OpenCode",
  "claude-code": "Claude Code",
  codex: "Codex",
  cursor: "Cursor",
};

export async function initCommand(projectDir: string, harnessFlag?: string): Promise<void> {
  clack.intro("Wiki-Agent v0.2.0");

  const s = clack.spinner();
  s.start("Scanning project for agent harnesses...");

  const detected = detectHarnesses(projectDir);
  s.stop(detected.length > 0 ? detected.map((h) => HARNESS_LABELS[h]).join(", ") + " detected" : "No harness detected");

  const wikiPath = await clack.text({
    message: "Where should the wiki be created?",
    placeholder: "./wiki",
    defaultValue: "./wiki",
  });

  if (clack.isCancel(wikiPath)) {
    clack.cancel("Cancelled");
    process.exit(0);
  }

  let selectedHarnesses: Harness[];

  if (harnessFlag) {
    selectedHarnesses = [harnessFlag as Harness];
    clack.log.success("Harness specified: " + HARNESS_LABELS[harnessFlag as Harness]);
  } else if (detected.length === 1) {
    selectedHarnesses = detected;
    clack.log.success("Auto-selected: " + HARNESS_LABELS[detected[0]]);
  } else if (detected.length === 0) {
    const allHarnesses = getAllHarnesses();
    const options = allHarnesses.map((h) => ({
      value: h as string,
      label: HARNESS_LABELS[h],
    }));

    const selection = await clack.multiselect({
      message: "Select harnesses to configure",
      options,
      required: true,
    });

    if (clack.isCancel(selection)) {
      clack.cancel("Cancelled");
      process.exit(0);
    }

    selectedHarnesses = selection as Harness[];
  } else {
    const allHarnesses = getAllHarnesses();
    const options = allHarnesses.map((h) => ({
      value: h as string,
      label: HARNESS_LABELS[h] + (detected.includes(h) ? " (detected)" : ""),
      hint: detected.includes(h) ? "Found in project" : undefined,
    }));

    const selection = await clack.multiselect({
      message: "Select harnesses to configure",
      options,
      initialValues: detected,
      required: true,
    });

    if (clack.isCancel(selection)) {
      clack.cancel("Cancelled");
      process.exit(0);
    }

    selectedHarnesses = selection as Harness[];
  }

  if (selectedHarnesses.length === 0) {
    clack.cancel("No harness selected");
    process.exit(1);
  }

  s.start("Building wiki structure...");

  const templates = new Map(Object.entries(TEMPLATES));

  if (!selectedHarnesses.includes("opencode")) {
    s.stop("Failed");
    clack.log.error("Only OpenCode harness is supported in v0.2.0. Support for " + selectedHarnesses.join(", ") + " coming soon.");
    process.exit(1);
  }

  const { actions, warnings } = generateForOpenCode(
    projectDir,
    templates,
    WIKI_SPEC,
    WIKI_SECTION,
  );

  s.stop("Wiki structure built");

  for (const action of actions) {
    clack.log.success(action);
  }
  for (const warning of warnings) {
    clack.log.warn(warning);
  }

  const harnessList = selectedHarnesses.map((h) => HARNESS_LABELS[h]).join(", ");

  clack.outro("Wiki initialized!\n\n  Wiki:     " + resolve(projectDir, "wiki") + "\n  Harness:  " + harnessList + "\n\n  Try: @wiki-search \"how does auth work?\"");
}