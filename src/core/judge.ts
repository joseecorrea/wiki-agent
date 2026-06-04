import type { InvertedIndex, ConflictPair } from "./types.js";

const SHARED_TAGS_THRESHOLD = 2;

export function findPotentialConflicts(index: InvertedIndex): ConflictPair[] {
  const conflicts: ConflictPair[] = [];
  const pageIds = Object.keys(index.pages);
  const seen = new Set<string>();

  for (let i = 0; i < pageIds.length; i++) {
    for (let j = i + 1; j < pageIds.length; j++) {
      const a = pageIds[i];
      const b = pageIds[j];
      const key = `${a}::${b}`;
      if (seen.has(key)) continue;

      const pageA = index.pages[a];
      const pageB = index.pages[b];
      if (!pageA || !pageB) continue;

      const sharedTags = pageA.tags.filter((t) => pageB.tags.includes(t));
      if (sharedTags.length >= SHARED_TAGS_THRESHOLD) {
        conflicts.push({
          pageA: a,
          pageB: b,
          reason: "shared_tags",
        });
        seen.add(key);
      }

      if (pageA.type === pageB.type && pageA.confidence !== pageB.confidence) {
        conflicts.push({
          pageA: a,
          pageB: b,
          reason: "same_type_confidence_mismatch",
        });
        seen.add(key);
      }
    }
  }

  return conflicts;
}