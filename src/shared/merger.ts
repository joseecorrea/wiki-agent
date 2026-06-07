import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { withFileLock } from "../core/lock.js";
import { writeFileAtomic } from "../core/atomic-write.js";

const START_MARKER = "<!-- WIKI-AGENT:START -->";
const END_MARKER = "<!-- WIKI-AGENT:END -->";

export function mergeIntoFile(
  filePath: string,
  content: string,
): "created" | "inserted" | "replaced" {
  return withFileLock(filePath, () => {
    if (!existsSync(filePath)) {
      const dir = dirname(filePath);
      if (!existsSync(dir)) {
        throw new Error(`Directory does not exist: ${dir}`);
      }
      writeFileAtomic(
        filePath,
        `${START_MARKER}\n${content}\n${END_MARKER}\n`,
      );
      return "created";
    }

    const existing = readFileSync(filePath, "utf-8");
    const startIndex = existing.indexOf(START_MARKER);
    const endIndex = existing.indexOf(END_MARKER);

    if (startIndex !== -1 && endIndex !== -1) {
      const before = existing.substring(0, startIndex);
      const after = existing.substring(endIndex + END_MARKER.length);
      writeFileAtomic(
        filePath,
        `${before}${START_MARKER}\n${content}\n${END_MARKER}${after}`,
      );
      return "replaced";
    }

    const needsNewline = !existing.endsWith("\n");
    writeFileAtomic(
      filePath,
      `${existing}${needsNewline ? "\n" : ""}\n${START_MARKER}\n${content}\n${END_MARKER}\n`,
    );
    return "inserted";
  });
}

export function mergeIntoJson(
  filePath: string,
  content: Record<string, unknown>,
): "created" | "merged" {
  return withFileLock(filePath, () => {
    if (!existsSync(filePath)) {
      const dir = dirname(filePath);
      if (!existsSync(dir)) {
        throw new Error(`Directory does not exist: ${dir}`);
      }
      writeFileAtomic(
        filePath,
        JSON.stringify(content, null, 2) + "\n",
      );
      return "created";
    }

    const existing = JSON.parse(readFileSync(filePath, "utf-8")) as Record<
      string,
      unknown
    >;

    const merged = deepMerge(existing, content);

    writeFileAtomic(filePath, JSON.stringify(merged, null, 2) + "\n");
    return "merged";
  });
}

function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): Record<string, unknown> {
  const result = { ...target };

  for (const key of Object.keys(source)) {
    if (
      key in result &&
      typeof result[key] === "object" &&
      result[key] !== null &&
      !Array.isArray(result[key]) &&
      typeof source[key] === "object" &&
      source[key] !== null &&
      !Array.isArray(source[key])
    ) {
      result[key] = deepMerge(
        result[key] as Record<string, unknown>,
        source[key] as Record<string, unknown>,
      );
    } else {
      result[key] = source[key];
    }
  }

  return result;
}

export function removeSection(filePath: string): boolean {
  return withFileLock(filePath, () => {
    if (!existsSync(filePath)) return false;

    const existing = readFileSync(filePath, "utf-8");
    const startIndex = existing.indexOf("<!-- WIKI-AGENT:START -->");
    const endIndex = existing.indexOf("<!-- WIKI-AGENT:END -->");

    if (startIndex === -1 || endIndex === -1) return false;

    const before = existing.substring(0, startIndex);
    const after = existing.substring(
      endIndex + "<!-- WIKI-AGENT:END -->".length,
    );

    const cleaned = (before + after).replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";

    writeFileAtomic(filePath, cleaned);
    return true;
  });
}