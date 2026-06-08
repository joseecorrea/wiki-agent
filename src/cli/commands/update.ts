import { resolve, join } from "node:path";
import { existsSync } from "node:fs";
import * as clack from "@clack/prompts";
import { needsMigration, hasMemoryWiki, migrateLegacyWiki } from "../../core/migrate.js";

export async function updateCommand(projectDir: string, force = false): Promise<void> {
  clack.intro("Wiki-Agent Update");

  // Case 1: Already migrated
  if (hasMemoryWiki(projectDir)) {
    if (needsMigration(projectDir)) {
      // Has both memory/ and legacy — edge case, warn but continue
      clack.log.warn("Both memory/ and legacy root items detected. Migrating legacy items into memory/.");
    } else {
      clack.outro("Wiki is already up to date. Nothing to do.");
      return;
    }
  }

  // Case 2: No wiki at all
  if (!needsMigration(projectDir) && !hasMemoryWiki(projectDir)) {
    clack.outro("No wiki found. Run 'wiki-agent init' first.");
    return;
  }

  // Case 3: Legacy detected — show preview
  const legacyItems = [
    join(projectDir, "wiki"),
    join(projectDir, "raw"),
    join(projectDir, ".wiki-agent"),
    join(projectDir, "wiki-spec.md"),
  ].filter((p) => existsSync(p));

  console.log("\nLegacy wiki structure detected. The following will be moved into memory/:\n");
  for (const item of legacyItems) {
    const rel = item.replace(projectDir + "/", "");
    console.log("  " + rel + "  →  memory/" + rel);
  }
  console.log("");

  let confirmed = force;
  if (!confirmed) {
    const answer = await clack.confirm({
      message: "Migrate legacy wiki into memory/?",
      initialValue: true,
    });

    if (clack.isCancel(answer)) {
      clack.cancel("Cancelled");
      process.exit(0);
    }

    confirmed = answer as boolean;
  }

  if (!confirmed) {
    clack.cancel("Migration cancelled");
    process.exit(0);
  }

  const s = clack.spinner();
  s.start("Migrating wiki to memory/...");

  try {
    migrateLegacyWiki(projectDir);
    s.stop("Migration complete");
    clack.outro("Wiki migrated to memory/.\n\n  Wiki: " + resolve(projectDir, "memory/wiki") + "\n\n  The search index will be rebuilt automatically on the next query.");
  } catch (err: any) {
    s.stop("Migration failed");
    clack.log.error(err.message);
    process.exit(1);
  }
}
