# Wiki-Agent Specification

Framework-agnostic specification for persistent memory wikis managed by LLM agents.

## Overview

Wiki-Agent implements a persistent, compounding knowledge base for LLM agents. Instead of re-deriving knowledge from raw sources on every query, the agent incrementally builds and maintains a structured wiki that grows richer over time.

The key innovation is **auto-learning**: as the agent works, it detects undocumented information and autonomously integrates it into the wiki, creating a feedback loop of continuous learning.

## Architecture

### Three Layers

1. **Raw sources** — Immutable source documents in `raw/`. The agent reads but never modifies these.
2. **The wiki** — A directory of agent-generated markdown files in `wiki/`. Summaries, entity pages, concept pages, comparisons, an evolving synthesis. The agent owns this layer entirely.
3. **The schema** — Instructions (AGENTS.md, CLAUDE.md, etc.) that tell the agent how the wiki is structured, what conventions to follow, and what workflows to execute.

### Sub-Agent Orchestration

To optimize token consumption and context health, wiki operations are delegated to specialized sub-agents. The main agent **never reads wiki files directly** — it only receives condensed summaries from sub-agents.

| Sub-agent | Responsibility | Input | Output |
|---|---|---|---|
| `wiki-search` | Search wiki for relevant context | Query or topic | Condensed summary of relevant pages (~500 words max) |
| `wiki-ingest` | Process and integrate a new source | Path or content of source | List of created/updated pages |
| `wiki-update` | Update specific pages with new info | Info + target pages | Confirmation of changes |
| `wiki-auto-learn` | Detect and integrate undocumented knowledge | Key facts from session | What was learned/added |
| `wiki-lint` | Health-check the wiki | Optional focus area | Report with recommended actions |

## Directory Structure

```
project-root/
├── wiki/
│   ├── index.md          # Catalog of all wiki content
│   ├── log.md            # Chronological append-only log
│   ├── overview.md       # Evolving synthesis of the project
│   └── pages/            # Agent creates pages here, flat or with subdirectories
│       ├── auth.md
│       ├── rate-limiting.md
│       └── architecture/
│           └── api-design.md
├── raw/
│   └── assets/           # Immutable source documents
└── AGENTS.md             # (or CLAUDE.md, etc.) — schema with wiki orchestration rules
```

The `pages/` directory starts flat. The agent decides when to create subdirectories for categories based on the volume and relatedness of pages.

## Wiki File Formats

### index.md

```markdown
# Wiki Index

## Entities
- [[auth]] — Authentication system using JWT with refresh tokens
- [[rate-limiting]] — Bucket-based rate limiting per user

## Concepts
- [[api-design]] — REST API design decisions and conventions

## Decisions
- [[adr-001-use-jwt]] — Use JWT over session-based auth

## Sources
- `raw/architecture-notes.md` — Ingested 2026-01-15
```

### log.md

```markdown
# Wiki Log

## [2026-01-15] ingest | Architecture Notes
- Created: [[auth]], [[api-design]]
- Updated: [[index]]

## [2026-01-16] auto-learn | Rate limiting pattern discovered
- Created: [[rate-limiting]]
- Updated: [[api-design]]
```

### overview.md

```markdown
# Project Overview

[An evolving synthesis, 2-4 paragraphs, that captures the current state of understanding. Updated by wiki-ingest and wiki-auto-learn when significant changes occur.]

## Key Architecture
[Bullet points of the most important architectural decisions and patterns.]

## Active Areas
[What's currently being worked on or investigated.]
```

### Page template (wiki/pages/*.md)

```markdown
---
title: Page Title
created: 2026-01-15
updated: 2026-01-16
tags: [tag1, tag2]
sources: [raw/source-file.md]
---

# Page Title

[Summary paragraph]

## Details
[Detailed content]

## Related
- [[other-page]] — Brief description of relationship

## Open Questions
- [Any unresolved questions about this topic]
```

## Operations

### Search (wiki-search)
1. Read `wiki/index.md` to identify relevant pages
2. Read relevant pages
3. Synthesize a condensed answer (~500 words max) with key facts
4. Return summary to the main agent — **never** return raw wiki content

### Ingest (wiki-ingest)
1. Read the source document from `raw/`
2. Discuss key takeaways (if interactive session)
3. Create summary page(s) in `wiki/pages/`
4. Update entity and concept pages across the wiki
5. Update `wiki/index.md` with new entries
6. Append entry to `wiki/log.md`
7. Update `wiki/overview.md` if the source changes the big picture
8. Return a concise list of created/updated pages to the main agent

### Update (wiki-update)
1. Read the specified pages
2. Integrate the new information
3. Update cross-references in related pages
4. Update `wiki/index.md` if new pages were created
5. Append entry to `wiki/log.md`
6. Return confirmation of changes

### Auto-Learn (wiki-auto-learn)
1. Receive key facts from the main agent's session
2. Check `wiki/index.md` to see if each fact is already documented
3. For undocumented facts:
   - Create new pages if the topic is significant enough
   - Update existing pages if the fact relates to an existing topic
4. Update `wiki/index.md` and `wiki/log.md`
5. Return what was learned/added

### Lint (wiki-lint)
1. Scan all pages in `wiki/pages/`
2. Check for:
   - Orphan pages (no inbound links from other wiki pages)
   - Missing cross-references between related pages
   - Contradictions between pages
   - Stale claims that newer sources may have superseded
   - Important concepts mentioned but lacking their own page
   - Pages significantly out of date (check `updated` frontmatter)
3. Check `wiki/index.md` completeness against actual pages
4. Return a structured report with recommended actions

## Token Optimization Rules

1. **Main agent never reads wiki files directly.** Always delegate to sub-agents.
2. **Sub-agents return condensed summaries**, not raw wiki content. Max ~500 words per response.
3. **Auto-learn is lightweight.** It receives pre-extracted facts, not full context.
4. **Search is targeted.** It reads the index first, then only relevant pages — never the entire wiki.
5. **Lint is periodic.** Run once per session at most, not on every interaction.

## Cross-Harness Compatibility

This spec is designed to be implementable across different agent harnesses:
- **OpenCode**: Sub-agents defined in `.opencode/agents/`, orchestration in `AGENTS.md`
- **Claude Code**: Adapted as CLAUDE.md instructions
- **Codex**: Adapted as AGENTS.md instructions
- **Custom agents**: Implement the same sub-agent interfaces via your framework

The wiki file format (markdown with frontmatter, `[[wikilinks]]`, index, log) is harness-agnostic and works with any markdown-aware tool.