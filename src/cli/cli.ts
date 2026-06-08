import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { initCommand } from "./commands/init.js";
import { addHarnessCommand } from "./commands/add-harness.js";
import { removeCommand } from "./commands/remove.js";
import { statusCommand } from "./commands/status.js";
import { searchCommand } from "./commands/search.js";
import { indexCommand } from "./commands/index-cmd.js";
import { updateCommand } from "./commands/update.js";
import { statsCommand } from "./commands/stats.js";

async function main() {
  const { values, positionals } = parseArgs({
    options: {
      harness: { type: "string" },
      dir: { type: "string" },
      type: { type: "string" },
      confidence: { type: "string" },
      tags: { type: "string" },
      force: { type: "boolean", short: "f" },
      help: { type: "boolean", short: "h" },
    },
    strict: false,
    allowPositionals: true,
  });

  if (values.help) {
    printHelp();
    return;
  }

  const command = positionals[0];
  const projectDir = values.dir ? resolve(values.dir as string) : process.cwd();

  switch (command) {
    case "init": {
      await initCommand(projectDir, values.harness as string | undefined);
      break;
    }
    case "update": {
      await updateCommand(projectDir, values.force as boolean | undefined);
      break;
    }
    case "status": {
      await statusCommand(projectDir);
      break;
    }
    case "search": {
      const query = positionals.slice(1).join(" ");
      if (!query) {
        console.error('Please provide a search query. Usage: wiki-agent search <query>');
        process.exit(1);
      }
      await searchCommand(query, projectDir, {
        type: values.type as string | undefined,
        confidence: values.confidence as string | undefined,
        tags: values.tags ? (values.tags as string).split(",") : undefined,
      });
      break;
    }
    case "index": {
      await indexCommand(projectDir);
      break;
    }
    case "stats": {
      await statsCommand(projectDir);
      break;
    }
    case "add-harness": {
      const harness = positionals[1];
      await addHarnessCommand(projectDir, harness);
      break;
    }
    case "remove": {
      await removeCommand(projectDir, values.force as boolean | undefined);
      break;
    }
    default:
      console.error("Unknown command: " + (command ?? "") + '. Run "wiki-agent --help" for usage.');
      printHelp();
      process.exit(1);
  }
}

function printHelp() {
  console.log(`
wiki-agent - Persistent memory wiki for LLM agents

Usage:
  wiki-agent init [options]           Initialize wiki in a project
  wiki-agent update [options]           Migrate legacy wiki to memory/ structure
  wiki-agent add-harness <harness>    Add sub-agents for a specific harness
  wiki-agent remove [options]         Remove all wiki-agent data from project
  wiki-agent status [options]         Show wiki status
  wiki-agent stats [options]          Show token savings metrics
  wiki-agent search <query> [opts]    Search the wiki
  wiki-agent index [options]          Build/rebuild the search index

Options:
  --harness <type>    Agent harness (only for init)
  --dir <path>        Project directory (default: .)
  --type <type>       Filter by page type (search)
  --confidence <lvl>  Filter by confidence (search)
  --tags <t1,t2>      Filter by tags (search)
  -f, --force         Skip confirmation prompts (remove, update)
  -h, --help          Show this help message

Supported harnesses:
  opencode            OpenCode with .opencode/ and AGENTS.md
  claude-code         Claude Code with .claude/ and CLAUDE.md
  codex               Codex with .codex/ and AGENTS.md
  cursor              Cursor with .cursor/ and .cursorrules
`);
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});