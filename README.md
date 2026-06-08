# wiki-agent

Persistent memory wiki for LLM agents — sub-agent orchestration, auto-learning, and BM25 search.

## What it does

Wiki-Agent gives your LLM agent a **persistent, compounding knowledge base** that grows organically as it works. Instead of re-deriving knowledge from scratch on every session, the agent builds and maintains a structured wiki that gets richer over time.

The key innovation is **auto-learning**: as the agent works on your project, it detects undocumented conventions, patterns, and decisions and autonomously integrates them into the wiki. No manual curation required.

It works by delegating wiki operations to **specialized sub-agents** that have their own isolated context, keeping your main agent's context clean and reducing token consumption by ~80%.

Additionally, **8 MCP tools** provide programmatic access for search, status, linting, conflict detection, and token savings metrics via any MCP-compatible agent.

## Sub-agents

| Sub-agent | What it does |
|---|---|
| `wiki-search` | Searches the wiki for relevant context and returns a condensed summary (~500 words max) |
| `wiki-ingest` | Processes a new source document and integrates it into the wiki |
| `wiki-update` | Updates specific wiki pages with targeted information while maintaining consistency |
| `wiki-auto-learn` | Detects undocumented knowledge during work sessions and integrates it into the wiki |
| `wiki-lint` | Health-checks the wiki: finds orphans, contradictions, stale content, missing cross-references |

## MCP Tools

| Tool | Purpose |
|---|---|
| `wiki_search` | BM25-powered search with type, confidence, and tag filters |
| `wiki_ingest` | Ingest a source document into the wiki |
| `wiki_update` | Update specific wiki pages |
| `wiki_auto_learn` | Detect and integrate undocumented knowledge |
| `wiki_lint` | Health-check for orphans, stale content, missing links |
| `wiki_judge` | Detect potential conflicts between pages |
| `wiki_status` | Wiki state overview (page count, types, index status) |
| `wiki_stats` | Token savings metrics: total saved, by tool, recent events |

## Quick start

```bash
# Run in any project directory (interactive TUI - auto-detects your harness)
npx wiki-agent init

# Or with pnpm
pnpm dlx wiki-agent init

# With explicit harness
npx wiki-agent init --harness opencode

# Target directory
npx wiki-agent init --dir /path/to/project
```

The init command presents an interactive TUI that:
- Creates the base wiki structure (directories, initial files, spec)
- Auto-detects your agent harness (OpenCode, Claude Code, Codex, Cursor)
- Lets you choose which harnesses to create sub-agents for (supports multiple)
- If none are detected, lets you select from all options

This creates:

```
your-project/
├── <harness>/agents/       # e.g. .opencode/agents/, .vscode/agents/, etc.
│   ├── wiki-search.md
│   ├── wiki-ingest.md
│   ├── wiki-update.md
│   ├── wiki-auto-learn.md
│   └── wiki-lint.md
├── memory/
│   ├── .wiki-agent/
│   │   └── index.json            # BM25 search index (tracked in git)
│   ├── wiki/
│   │   ├── index.md              # Catalog of all wiki content
│   │   ├── log.md                # Chronological activity log
│   │   ├── overview.md           # Evolving project synthesis
│   │   └── pages/                # Individual topic pages
│   ├── raw/
│   │   └── assets/               # Immutable source documents
│   └── wiki-spec.md              # Framework-agnostic specification
├── AGENTS.md                       # Merged with wiki-agent orchestration rules
└── <harness-config>                # e.g. opencode.json, CLAUDE.md, .cursorrules
```

## CLI Commands

```bash
# Initialize wiki with interactive TUI
wiki-agent init [--harness <type>] [--dir <path>]

# Migrate legacy wiki (root-level) to memory/ structure
wiki-agent update [--dir <path>]

# Add sub-agents for a specific harness to an existing wiki
wiki-agent add-harness <harness> [--dir <path>]

# Remove all wiki-agent data from a project (shows preview + asks for confirmation)
wiki-agent remove [--dir <path>]

# Force removal without confirmation (use with caution)
wiki-agent remove --force [--dir <path>]

# Show wiki status
wiki-agent status [--dir <path>]

# Show token savings metrics
wiki-agent stats [--dir <path>]

# Search the wiki (BM25)
wiki-agent search <query> [--type <type>] [--confidence <level>] [--tags <t1,t2>]

# Build or rebuild the search index
wiki-agent index [--dir <path>]
```

## Page Metadata

Every wiki page includes enriched frontmatter:

```yaml
---
title: Page Title
created: 2026-01-15
updated: 2026-01-16
tags: [auth, jwt, security]
sources: [raw/architecture-notes.md]
type: architecture | decision | pattern | gotcha | entity | concept
confidence: high | medium | low
related:
  - "[[other-page]]"
---
```

### Types
- **architecture** — System design, component relationships, data flow
- **decision** — ADRs, technology choices, design decisions
- **pattern** — Recurring solutions, best practices, conventions
- **gotcha** — Pitfalls, common mistakes, non-obvious behaviors
- **entity** — People, teams, services, external systems
- **concept** — Abstract ideas, mental models, domain knowledge

## How it works

### Three layers

1. **Raw sources** (`memory/raw/`) — Your immutable source documents. The agent reads but never modifies these.
2. **The wiki** (`memory/wiki/`) — Agent-generated markdown files. Summaries, entity pages, concept pages. The agent owns this layer entirely.
3. **The schema** (`AGENTS.md`) — Instructions that tell the agent how the wiki is structured and when to delegate to sub-agents.

### Dual interface: sub-agents + MCP tools

**Sub-agents** handle complex tasks (ingestion, multi-page updates, maintenance) with their own context.

**MCP tools** provide fast programmatic access for search, status, and maintenance — available to any MCP-compatible agent.

### Token optimization

The main agent **never reads wiki files directly**. Instead:

```
Agent needs context about auth
  → delegates to wiki-search
  ← receives 500-word condensed summary
  → continues work with clean context
```

Or uses `wiki_search` MCP tool for targeted BM25 queries.

### Token Savings Metrics

Wiki-Agent automatically tracks estimated tokens saved by using the wiki instead of direct file reads. Every MCP tool invocation and CLI command records a conservative estimate based on `characters / 4` (a universal heuristic compatible with most LLM tokenizers).

- **Search**: tokens of full matching pages minus tokens of returned excerpts
- **Status/Lint/Judge**: tokens of the entire wiki minus tokens of the structured response
- **Ingest/Update/Auto-learn**: tokens of the input the main agent didn't have to process

View your savings anytime:

```bash
wiki-agent stats
```

Or via MCP: `wiki_stats` returns total saved, operations count, breakdown by tool, and recent events.

Metrics are stored in `memory/.wiki-agent/metrics.json` (safe for git tracking) with atomic writes and file locks to handle concurrent sub-agents.

### Auto-learning

As the agent works, it follows triggers defined in `AGENTS.md`:

- Discovers an undocumented convention → delegates to `wiki-auto-learn`
- Finds an architecture decision not in the wiki → delegates to `wiki-auto-learn`
- Solves a bug worth preserving → delegates to `wiki-auto-learn`

This creates a feedback loop: the more the agent works, the more it learns, the richer the wiki becomes.

## Search

Wiki-Agent uses a custom BM25 inverted index with:

- Stopword removal and suffix stemming
- Type, confidence, and tag filters
- Automatic index rebuilding when pages change
- Index tracked in git (`.wiki-agent/index.json`)

```bash
# Build the search index
wiki-agent index

# Search
wiki-agent search "authentication flow"
wiki-agent search "api design" --type pattern --confidence high
wiki-agent status
```

## Safe merging

If your project already has an `AGENTS.md`, Wiki-Agent **appends** its section using markers:

```html
<!-- WIKI-AGENT:START -->
## Wiki-Agent: Persistent Memory
...
<!-- WIKI-AGENT:END -->
```

Your existing content is preserved. Re-running `init` updates only the marked section — no duplication.

Same for `opencode.json`: agent definitions and MCP server config are merged in, existing config is untouched.

## Adding sources

Drop documents into `memory/raw/` and delegate to `wiki-ingest`:

```
User: "Process memory/raw/architecture-notes.md"
Agent → delegates to wiki-ingest
         → reads the source
         → creates/updates 5-15 wiki pages
         → updates index and log
         ← returns summary of changes
```

## Linting

Periodically delegate to `wiki-lint` or use `wiki_lint` MCP tool to keep the wiki healthy:

- Finds orphan pages with no inbound links
- Flags contradictions between pages
- Detects missing cross-references
- Identifies important concepts without their own page
- Checks index completeness

## Removing wiki-agent

If you want to remove wiki-agent from a project, use the `remove` command:

```bash
wiki-agent remove
```

This scans the project and shows a **preview** of everything that will be touched, then asks for confirmation. It only removes wiki-agent-created content:

- `memory/wiki/` — agent-generated wiki pages
- `memory/.wiki-agent/` — BM25 search index
- `memory/raw/assets/` — directory created by wiki-agent (only if empty afterward)
- `memory/wiki-spec.md` — framework specification
- `<harness>/agents/wiki-*.md` — sub-agent definition files
- Instruction file sections — removes only the `<!-- WIKI-AGENT:START -->...<!-- WIKI-AGENT:END -->` blocks from `AGENTS.md`, `CLAUDE.md`, `.cursorrules`, etc., preserving your existing content
- `opencode.json` — removes only the `mcp.wiki-agent` and `agent.wiki-*` entries, leaving your other config intact

To skip the confirmation prompt:

```bash
wiki-agent remove --force
```

## Supported harnesses

| Harness | Status |
|---|---|
| OpenCode | Supported (sub-agents + MCP) |
| Claude Code | Supported |
| Codex | Supported |
| Cursor | Supported |

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run locally
node dist/cli.js init --harness opencode

# Run MCP server
node dist/mcp-server.js
```

## License

MIT