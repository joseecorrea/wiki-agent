# wiki-agent

Persistent memory wiki for LLM agents — sub-agent orchestration, auto-learning, and BM25 search.

## What it does

Wiki-Agent gives your LLM agent a **persistent, compounding knowledge base** that grows organically as it works. Instead of re-deriving knowledge from scratch on every session, the agent builds and maintains a structured wiki that gets richer over time.

The key innovation is **auto-learning**: as the agent works on your project, it detects undocumented conventions, patterns, and decisions and autonomously integrates them into the wiki. No manual curation required.

It works by delegating wiki operations to **specialized sub-agents** that have their own isolated context, keeping your main agent's context clean and reducing token consumption by ~80%.

Additionally, **7 MCP tools** provide programmatic access for search, status, linting, and conflict detection via any MCP-compatible agent.

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
- Auto-detects your agent harness (OpenCode, Claude Code, Codex, Cursor)
- If one harness is detected, auto-selects it
- If multiple are detected, lets you choose which to configure
- If none are detected, lets you select from all options

This creates:

```
your-project/
├── .opencode/agents/
│   ├── wiki-search.md
│   ├── wiki-ingest.md
│   ├── wiki-update.md
│   ├── wiki-auto-learn.md
│   └── wiki-lint.md
├── .wiki-agent/
│   └── index.json      # BM25 search index (tracked in git)
├── wiki/
│   ├── index.md        # Catalog of all wiki content
│   ├── log.md          # Chronological activity log
│   ├── overview.md     # Evolving project synthesis
│   └── pages/          # Individual topic pages
├── raw/
│   └── assets/         # Immutable source documents
├── AGENTS.md           # Merged with wiki-agent orchestration rules
├── opencode.json       # Updated with sub-agent definitions and MCP server
└── wiki-spec.md        # Framework-agnostic specification
```

## CLI Commands

```bash
# Initialize wiki with interactive TUI
wiki-agent init [--harness <type>] [--dir <path>]

# Show wiki status
wiki-agent status [--dir <path>]

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

1. **Raw sources** (`raw/`) — Your immutable source documents. The agent reads but never modifies these.
2. **The wiki** (`wiki/`) — Agent-generated markdown files. Summaries, entity pages, concept pages. The agent owns this layer entirely.
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

Drop documents into `raw/` and delegate to `wiki-ingest`:

```
User: "Process raw/architecture-notes.md"
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

## Supported harnesses

| Harness | Status |
|---|---|
| OpenCode | Supported (sub-agents + MCP) |
| Claude Code | Planned |
| Codex | Planned |
| Cursor | Planned |

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