# Release Notes — Wiki-Agent v0.4.0

**Release Date:** 2026-06-08

---

## Highlights

### Incremental Index Updates (Breaking Change)

The biggest change in v0.4.0: the search index is now updated **incrementally** instead of rebuilt from scratch every time.

**Before:** Every time a file changed, `wiki-agent` re-read, re-parsed, and re-tokenized **every** markdown file in the wiki to rebuild the entire index.

**Now:** Only files that are **new**, **modified**, or **deleted** are processed. The rest of the index remains untouched.

#### Impact
- Wikis with hundreds of pages no longer experience multi-second rebuilds on every search.
- Latency of `wiki_search`, `wiki_judge`, and `wiki-agent index` drops significantly for large wikis.
- I/O is reduced to O(changed files) instead of O(total files).

#### How it works
- Each indexed file is tracked with a **SHA-256 hash** of its content.
- On every index operation, the system compares the current filesystem state against the stored hashes.
- Only files with hash mismatches (or missing/extra files) are re-indexed.

---

## Breaking Changes

### InvertedIndex Schema v3

The internal index format (`memory/.wiki-agent/index.json`) has changed:

- `IndexEntry.positions` changed from `number[]` (flat array) to `Record<string, number[]>` (per-page positions).
- New top-level field: `fileStates` — maps each file path to its SHA-256 hash.

**Migration:** Existing indexes will be detected as stale on first access and **auto-rebuilt** transparently. No manual action required.

---

## New Features

### CLI
- `wiki-agent index` is now **incremental by default**.
- `wiki-agent index --force` performs a **full rebuild** when needed.
- Improved feedback messages: "Index updated", "Index up to date", or "Index rebuilt".

### Core Engine
- **`updateIndex()`** — new public function for partial index updates.
- **`removePageFromIndex()`** — removes a single page and cleans up all term references.
- **Recursive staleness detection** — fixes a bug where changes in subdirectories of `pages/` were not detected (previous check was only shallow).

---

## Bug Fixes

### Path Traversal Protection
- Added `resolveSafePath()` to prevent `../` escapes in file operations.
- Applied consistently across `getPagePath()`, `searchWiki()`, `resolveRelativeTo()`, and `estimateSearchTokensSaved()`.

### Version Drift
- Centralized version constant in `src/shared/version.ts`.
- CLI commands (`init`, `add-harness`, `remove`) and MCP server now read from a single source of truth instead of hardcoded strings.

---

## Other Changes

- **Multilingual tokenizer** (already in v0.3.x but refined): EN/ES auto-detection, Unicode normalization, inline stemming without dependencies.
- **Test coverage**: Added 8 new tests for index-builder covering add/remove/modify/title-change/staleness scenarios.

---

## Upgrade Guide

```bash
# Pull the new version
npm install -g wiki-agent@0.4.0

# Your existing wiki will work transparently
# The first search or index command will auto-rebuild the index to v3
cd your-project
wiki-agent index
```

No configuration or file structure changes are required.

---

## Full Changelog

```
26b974c refactor(shared): centralize version in single source of truth
c16a0ce chore(release): bump version to 0.4.0
038e103 feat(core)!: incremental index updates with SHA-256 staleness detection
41cd696 feat(core): add ES/EN multilingual tokenizer with auto-detection
a0fbd3a fix(core): add path traversal protection with resolveSafePath
bda83fa refactor(core): move mid-file imports to top in metrics.ts
65b6e6e feat: add token savings metrics tracking
7066de4 feat: move wiki structure into memory/ directory with legacy migration
```

---

*For issues or questions, visit: https://github.com/joseecorrea/wiki-agent/issues*
