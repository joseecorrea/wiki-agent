import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { detectHarness } from "./detectors.js";
import { generateForOpenCode } from "./generators/opencode.js";
import { TEMPLATES, WIKI_SECTION, WIKI_SPEC } from "./templates.js";

function main() {
  const { values, positionals } = parseArgs({
    options: {
      harness: { type: "string" },
      dir: { type: "string" },
      help: { type: "boolean", short: "h" },
    },
    strict: true,
    allowPositionals: true,
  });

  if (values.help) {
    printHelp();
    return;
  }

  const command = positionals[0];
  if (!command || command !== "init") {
    console.error('Unknown command. Run "wiki-agent init" to initialize.');
    printHelp();
    process.exit(1);
  }

  const projectDir = values.dir ? resolve(values.dir) : process.cwd();

  const harness =
    (values.harness as string | undefined) ?? detectHarness(projectDir);

  if (!harness) {
    console.error(
      "Could not detect agent harness. Use --harness to specify one of: opencode, claude-code, codex",
    );
    process.exit(1);
  }

  if (harness !== "opencode") {
    console.error(
      `Harness "${harness}" is not supported yet. Only "opencode" is available in v0.1.0.`,
    );
    process.exit(1);
  }

  console.log(`\nWiki-Agent Initializing`);
  console.log(`  Harness: ${harness}`);
  console.log(`  Project: ${projectDir}\n`);

  const templates = new Map(Object.entries(TEMPLATES));
  const { actions, warnings } = generateForOpenCode(
    projectDir,
    templates,
    WIKI_SPEC,
    WIKI_SECTION,
  );

  for (const action of actions) {
    console.log(`  [ok] ${action}`);
  }

  for (const warning of warnings) {
    console.log(`  [warn] ${warning}`);
  }

  console.log(`\nWiki-Agent initialized successfully!\n`);
  console.log(`Next steps:`);
  console.log(`  1. Review AGENTS.md for the wiki-agent orchestration section`);
  console.log(`  2. Restart your agent (OpenCode) to load the new sub-agents`);
  console.log(`  3. Add source documents to raw/ and delegate to wiki-ingest`);
  console.log(`  4. At session start, delegate to wiki-search for context`);
  console.log();
}

function printHelp() {
  console.log(`
wiki-agent - Persistent memory wiki for LLM agents

Usage:
  wiki-agent init [options]

Options:
  --harness <type>   Agent harness to use (opencode)
                     Default: auto-detect
  --dir <path>       Project directory (default: current directory)
  -h, --help         Show this help message

Supported harnesses (v0.1.0):
  opencode           OpenCode with .opencode/agents/ and AGENTS.md
`);
}

main();