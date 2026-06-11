import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildIndex, updateIndex, isIndexStale, removePageFromIndex, loadIndex } from "./index-builder.js";
import { getIndexPath } from "./utils.js";
import { searchWiki } from "./wiki-ops.js";
import type { InvertedIndex } from "./types.js";

function createTestWiki(projectDir: string, files: Record<string, string>) {
  const wikiDir = join(projectDir, "memory", "wiki");
  const pagesDir = join(wikiDir, "pages");
  mkdirSync(pagesDir, { recursive: true });
  for (const [relPath, content] of Object.entries(files)) {
    const fullPath = join(wikiDir, relPath);
    mkdirSync(join(fullPath, ".."), { recursive: true });
    writeFileSync(fullPath, content);
  }
}

function pageContent(title: string, body: string): string {
  return `---
title: ${title}
created: 2024-01-01
updated: 2024-01-01
tags: []
sources: []
type: concept
confidence: medium
related: []
---

${body}`;
}

describe("index-builder", () => {
  let projectDir: string;

  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), "wiki-agent-test-"));
  });

  afterEach(() => {
    rmSync(projectDir, { recursive: true, force: true });
  });

  it("buildIndex creates correct schema with fileStates and per-page positions", () => {
    createTestWiki(projectDir, {
      "pages/auth.md": pageContent("Authentication", "JWT auth pattern"),
      "pages/session.md": pageContent("Session Management", "session cookie pattern"),
    });

    const index = buildIndex(projectDir);

    assert.equal(index.version, 3);
    assert.ok(index.builtAt);
    assert.equal(index.stats.totalPages, 2);

    // fileStates should exist and have hashes
    assert.ok(Object.keys(index.fileStates).length > 0);
    assert.ok(index.fileStates["memory/wiki/pages/auth.md"]?.hash);
    assert.ok(index.fileStates["memory/wiki/pages/session.md"]?.hash);

    // positions should be Record<string, number[]>
    const jwtEntry = index.entries["jwt"];
    if (jwtEntry) {
      assert.ok(Array.isArray(jwtEntry.positions["authentication"]));
    }
  });

  it("updateIndex adds a new page", () => {
    createTestWiki(projectDir, {
      "pages/auth.md": pageContent("Authentication", "JWT auth pattern"),
    });

    const index = buildIndex(projectDir);
    assert.equal(index.stats.totalPages, 1);

    createTestWiki(projectDir, {
      "pages/session.md": pageContent("Session Management", "session cookie pattern"),
    });

    const updated = updateIndex(projectDir, index);
    assert.equal(updated.stats.totalPages, 2);
    assert.ok(updated.pages["session-management"]);
    assert.ok(updated.fileStates["memory/wiki/pages/session.md"]);
  });

  it("updateIndex removes a deleted page", () => {
    createTestWiki(projectDir, {
      "pages/auth.md": pageContent("Authentication", "JWT auth pattern"),
      "pages/session.md": pageContent("Session Management", "session cookie pattern"),
    });

    const index = buildIndex(projectDir);
    assert.equal(index.stats.totalPages, 2);
    assert.ok(index.pages["authentication"]);

    rmSync(join(projectDir, "memory", "wiki", "pages", "auth.md"));

    const updated = updateIndex(projectDir, index);
    assert.equal(updated.stats.totalPages, 1);
    assert.ok(!updated.pages["authentication"]);
  });

  it("updateIndex updates a modified page", () => {
    createTestWiki(projectDir, {
      "pages/auth.md": pageContent("Authentication", "JWT auth pattern"),
    });

    const index = buildIndex(projectDir);
    assert.ok(index.entries["jwt"]);

    writeFileSync(
      join(projectDir, "memory", "wiki", "pages", "auth.md"),
      pageContent("Authentication", "OAuth2 authorization pattern")
    );

    const updated = updateIndex(projectDir, index);
    assert.ok(!updated.entries["jwt"]); // old term removed
    assert.ok(updated.entries["oauth2"] || updated.entries["author"] || updated.entries["pattern"]);
    assert.ok(updated.pages["authentication"]);
  });

  it("isIndexStale detects changes in subdirectories", () => {
    createTestWiki(projectDir, {
      "pages/auth.md": pageContent("Authentication", "JWT auth pattern"),
    });

    const index = buildIndex(projectDir);
    assert.equal(isIndexStale(projectDir, index), false);

    createTestWiki(projectDir, {
      "pages/subdir/new.md": pageContent("New Sub Page", "new content here"),
    });

    assert.equal(isIndexStale(projectDir, index), true);
  });

  it("removePageFromIndex cleans up all references", () => {
    createTestWiki(projectDir, {
      "pages/auth.md": pageContent("Authentication", "JWT auth pattern"),
      "pages/session.md": pageContent("Session Management", "session cookie pattern"),
    });

    const index = buildIndex(projectDir);
    const originalDocCount = index.stats.totalPages;
    assert.ok(originalDocCount > 0);

    removePageFromIndex(index, "authentication");

    assert.equal(index.stats.totalPages, originalDocCount - 1);
    assert.ok(!index.pages["authentication"]);
    assert.ok(!index.stats.docLengths["authentication"]);

    // Ensure no dangling docIds or tf entries remain
    for (const entry of Object.values(index.entries)) {
      assert.ok(!entry.docIds.includes("authentication"));
      assert.ok(!entry.tf["authentication"]);
      assert.ok(!entry.positions["authentication"]);
    }
  });

  it("updateIndex handles page title changes", () => {
    createTestWiki(projectDir, {
      "pages/auth.md": pageContent("Authentication", "JWT auth pattern"),
    });

    const index = buildIndex(projectDir);
    assert.ok(index.pages["authentication"]);
    assert.ok(index.entries["jwt"]);

    // Change the title in frontmatter
    writeFileSync(
      join(projectDir, "memory", "wiki", "pages", "auth.md"),
      pageContent("Auth Strategy", "OAuth2 authorization pattern")
    );

    const updated = updateIndex(projectDir, index);
    // Old page ID should be gone
    assert.ok(!updated.pages["authentication"]);
    // New page ID should exist
    assert.ok(updated.pages["auth-strategy"]);
    // Old term should be removed
    assert.ok(!updated.entries["jwt"]);
    // New term should be present
    assert.ok(updated.entries["oauth2"] || updated.entries["author"]);
  });

  it("updateIndex with no changes returns equivalent index", () => {
    createTestWiki(projectDir, {
      "pages/auth.md": pageContent("Authentication", "JWT auth pattern"),
    });

    const index = buildIndex(projectDir);
    const updated = updateIndex(projectDir, index);

    assert.equal(updated.stats.totalPages, index.stats.totalPages);
    assert.equal(updated.stats.totalTerms, index.stats.totalTerms);
    assert.deepEqual(Object.keys(updated.pages).sort(), Object.keys(index.pages).sort());
  });

  it("loadIndex returns null for legacy v1 index format", () => {
    createTestWiki(projectDir, {
      "pages/auth.md": pageContent("Authentication", "JWT auth pattern"),
    });

    const legacyIndex = {
      version: "1.0.0",
      lastUpdated: "2026-06-11T00:00:00.000Z",
      totalPages: 1,
      index: {
        username: ["username-rules.md"],
      },
      pages: {
        "username-rules.md": {
          path: "memory/wiki/pages/username-rules.md",
          title: "Reglas de Validación de Username",
          type: "architecture",
          confidence: "high",
          date: "2026-06-11",
          tags: ["username", "validation"],
          wordCount: 80,
          tokens: ["username"],
        },
      },
    };

    const indexPath = getIndexPath(projectDir);
    mkdirSync(join(indexPath, ".."), { recursive: true });
    writeFileSync(indexPath, JSON.stringify(legacyIndex, null, 2));

    const loaded = loadIndex(projectDir);
    assert.equal(loaded, null);
  });

  it("searchWiki does not crash when legacy index is present", () => {
    createTestWiki(projectDir, {
      "pages/auth.md": pageContent("Authentication", "JWT auth pattern"),
    });

    const legacyIndex = {
      version: "1.0.0",
      lastUpdated: "2026-06-11T00:00:00.000Z",
      totalPages: 1,
      index: {},
      pages: {},
    };

    const indexPath = getIndexPath(projectDir);
    mkdirSync(join(indexPath, ".."), { recursive: true });
    writeFileSync(indexPath, JSON.stringify(legacyIndex, null, 2));

    const results = searchWiki(projectDir, "JWT");
    assert.equal(results.length, 1);
    assert.equal(results[0].title, "Authentication");
  });
});
