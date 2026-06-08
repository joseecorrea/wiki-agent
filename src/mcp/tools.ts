import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { handleSearch, handleIngest, handleUpdate, handleAutoLearn, handleLint, handleJudge, handleStatus, handleStats } from "./handlers.js";

export function registerTools(server: McpServer): void {
  server.tool(
    "wiki_search",
    "Search the project wiki for relevant context using BM25 ranking. Returns condensed summaries of matching pages.",
    {
      query: z.string().describe("Search query"),
      type: z.enum(["architecture", "decision", "pattern", "gotcha", "entity", "concept"]).optional().describe("Filter by page type"),
      confidence: z.enum(["high", "medium", "low"]).optional().describe("Filter by confidence level"),
      tags: z.string().optional().describe("Comma-separated tags to filter by"),
    },
    handleSearch,
  );

  server.tool(
    "wiki_ingest",
    "Ingest a new source document into the wiki. Creates new pages and updates existing ones based on the source content.",
    {
      source: z.string().describe("Path to source file in raw/ directory"),
      title: z.string().optional().describe("Title for the source (auto-detected if omitted)"),
    },
    handleIngest,
  );

  server.tool(
    "wiki_update",
    "Update specific wiki pages with new information while maintaining consistency across the wiki.",
    {
      page: z.string().describe("Page name to update"),
      content: z.string().describe("New content or changes to apply"),
    },
    handleUpdate,
  );

  server.tool(
    "wiki_auto_learn",
    "Detect undocumented information and integrate it into the wiki autonomously.",
    {
      facts: z.string().describe("Key facts, patterns, or decisions discovered during the session"),
    },
    handleAutoLearn,
  );

  server.tool(
    "wiki_lint",
    "Health-check the wiki for orphans, contradictions, stale content, and missing cross-references.",
    {},
    handleLint,
  );

  server.tool(
    "wiki_judge",
    "Detect potential conflicts between wiki pages: overlapping tags, mutual links, and confidence mismatches.",
    {},
    handleJudge,
  );

  server.tool(
    "wiki_status",
    "Get the current status of the wiki: page count, types, index status, and recent activity.",
    {},
    handleStatus,
  );

  server.tool(
    "wiki_stats",
    "Get token savings metrics: total tokens saved, operations count, and breakdown by tool. Shows the value provided by the wiki-agent system.",
    {},
    handleStats,
  );
}