# wiki-agent

Persistent memory wiki for LLM agents — auto-learning sub-agent orchestration.

## What it does

Wiki-Agent gives your LLM agent (OpenCode) a **persistent, compounding knowledge base** that grows organically as it works. Instead of re-deriving knowledge from scratch on every session, the agent builds and maintains a structured wiki that gets richer over time.

The key innovation is **auto-learning**: as the agent works on your project, it detects undocumented conventions, patterns, and decisions — and autonomously integrates them into the wiki. No manual curation required.

It works by delegating wiki operations to **specialized sub-agents** that have their own isolated context, keeping your main agent's context clean and reducing token consumption by ~80%.

## Sub-agents

| Sub-agent | What it does |
|---|---|
| `wiki-search` | Searches the wiki for relevant context and returns a condensed summary (~500 words max). The main agent never reads wiki files directly. |
| `wiki-ingest` | Processes a new source document and integrates it into the wiki — creating pages, updating cross-references, index, and log. |
| `wiki-update` | Updates specific wiki pages with targeted information while maintaining consistency across related pages. |
| `wiki-auto-learn` | Detects undocumented knowledge during work sessions and integrates it into the wiki. This is the feedback loop that makes the wiki compound. |
| `wiki-lint` | Health-checks the wiki: finds orphans, contradictions, stale content, missing cross-references, and gaps. |

## Quick start

```bash
# Run in any project directory (auto-detects your agent harness)
npx wiki-agent init

# Or with pnpm
pnpm dlx wiki-agent init

# Explicit harness
npx wiki-agent init --harness opencode

# Target directory
npx wiki-agent init --dir /path/to/project
```

This creates:

```
your-project/
├── .opencode/agents/
│   ├── wiki-search.md
│   ├── wiki-ingest.md
│   ├── wiki-update.md
│   ├── wiki-auto-learn.md
│   └── wiki-lint.md
├── wiki/
│   ├── index.md        # Catalog of all wiki content
│   ├── log.md          # Chronological activity log
│   ├── overview.md     # Evolving project synthesis
│   └── pages/          # Individual topic pages
├── raw/
│   └── assets/         # Immutable source documents
├── AGENTS.md           # Merged with wiki-agent orchestration rules
├── opencode.json       # Updated with sub-agent definitions
└── wiki-spec.md        # Framework-agnostic specification
```

## How it works

### Three layers

1. **Raw sources** (`raw/`) — Your immutable source documents. The agent reads but never modifies these.
2. **The wiki** (`wiki/`) — Agent-generated markdown files. Summaries, entity pages, concept pages. The agent owns this layer entirely.
3. **The schema** (`AGENTS.md`) — Instructions that tell the agent how the wiki is structured and when to delegate to sub-agents.

### Token optimization

The main agent **never reads wiki files directly**. Instead:

```
Agent needs context about auth
  → delegates to wiki-search
  ← receives 500-word condensed summary
  → continues work with clean context
```

Without sub-agents, the main agent would load the entire wiki into its context on every query. With sub-agents, each operation gets its own isolated context that doesn't pollute the main agent's window.

### Auto-learning

As the agent works, it follows triggers defined in `AGENTS.md`:

- Discovers an undocumented convention → delegates to `wiki-auto-learn`
- Finds an architecture decision not in the wiki → delegates to `wiki-auto-learn`
- Solves a bug worth preserving → delegates to `wiki-auto-learn`

This creates a feedback loop: the more the agent works, the more it learns, the richer the wiki becomes.

## Safe merging

If your project already has an `AGENTS.md`, Wiki-Agent **appends** its section using markers:

```html
<!-- WIKI-AGENT:START -->
## Wiki-Agent: Persistent Memory
...
<!-- WIKI-AGENT:END -->
```

Your existing content is preserved. Re-running `init` updates only the marked section — no duplication.

Same for `opencode.json`: agent definitions are merged in, existing config is untouched.

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

Periodically delegate to `wiki-lint` to keep the wiki healthy:

- Finds orphan pages with no inbound links
- Flags contradictions between pages
- Detects missing cross-references
- Identifies important concepts without their own page
- Checks index completeness

## Supported harnesses

| Harness | Status |
|---|---|
| OpenCode | Supported |
| Claude Code | Planned |
| Codex | Planned |

## Development

```bash
# Install dependencies
pnpm install

# Build
pnpm build

# Run locally
node dist/cli.js init --harness opencode
```

## License

MIT