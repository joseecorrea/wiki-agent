/**
 * Estimate token count from text using a universal heuristic.
 * The ratio of ~4 characters per token fits most modern LLM tokenizers
 * (GPT-4, Claude, Llama, etc.) for English/Spanish prose.
 */
export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

/**
 * Estimate tokens for a file path. Returns 0 if file cannot be read.
 */
import { existsSync, readFileSync } from "node:fs";

export function estimateFileTokens(filePath: string): number {
  if (!existsSync(filePath)) return 0;
  try {
    const content = readFileSync(filePath, "utf-8");
    return estimateTokens(content);
  } catch {
    return 0;
  }
}
