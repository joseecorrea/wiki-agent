import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { tokenize, tokenizeWithPositions, detectLanguage } from "./tokenizer.js";

describe("tokenizer", () => {
  // ─── EN tests ───────────────────────────────────────────

  it("tokenizes basic English with stemming", () => {
    const tokens = tokenize("running runners", "en");
    assert.deepEqual(tokens, ["run", "runner"]);
  });

  it("removes English stopwords", () => {
    const tokens = tokenize("the quick brown fox", "en");
    assert.deepEqual(tokens, ["quick", "brown", "fox"]);
  });

  it("stems English suffixes correctly", () => {
    assert.deepEqual(tokenize("running", "en"), ["run"]);
    assert.deepEqual(tokenize("happiness", "en"), ["happi"]);
    // Simple suffix stemmer strips "ization" first → "national"
    assert.deepEqual(tokenize("nationalization", "en"), ["national"]);
  });

  // ─── ES tests ───────────────────────────────────────────

  it("normalizes Spanish accents and tokenizes", () => {
    const tokens = tokenize("autenticación", "es");
    assert.deepEqual(tokens, ["autentic"]);
  });

  it("removes Spanish stopwords", () => {
    const tokens = tokenize("el la los de del al y o", "es");
    assert.deepEqual(tokens, []);
  });

  it("stems Spanish gerunds", () => {
    assert.deepEqual(tokenize("autenticando", "es"), ["autentic"]);
    assert.deepEqual(tokenize("leyendo", "es"), ["le"]);
  });

  it("stems Spanish past participles and infinitives", () => {
    assert.deepEqual(tokenize("autenticado", "es"), ["autentic"]);
    assert.deepEqual(tokenize("autenticar", "es"), ["autentic"]);
  });

  it("stems Spanish plural nouns", () => {
    assert.deepEqual(tokenize("autenticaciones", "es"), ["autentic"]);
    // "sistema" is singular; simple stemmer strips "s" only
    assert.deepEqual(tokenize("sistemas", "es"), ["sistema"]);
  });

  it("stems Spanish -mente adverbs", () => {
    // After stripping -mente, "rapida" remains (no further over-stemming)
    assert.deepEqual(tokenize("rápidamente", "es"), ["rapida"]);
  });

  // ─── Auto-detection tests ───────────────────────────────

  it("detects Spanish by accented characters", () => {
    assert.equal(detectLanguage("cómo implementar autenticación"), "es");
    assert.equal(detectLanguage("rápido"), "es");
  });

  it("detects Spanish by stopword density", () => {
    assert.equal(detectLanguage("el sistema de autenticacion"), "es");
  });

  it("detects English for pure ASCII with English signals", () => {
    assert.equal(detectLanguage("JWT authentication flow"), "en");
    assert.equal(detectLanguage("running implementation"), "en");
  });

  // ─── Edge cases ─────────────────────────────────────────

  it("returns empty array for empty string", () => {
    assert.deepEqual(tokenize("", "en"), []);
    assert.deepEqual(tokenize("", "es"), []);
  });

  it("returns empty array for single character", () => {
    assert.deepEqual(tokenize("a", "en"), []);
    assert.deepEqual(tokenize("y", "es"), []);
  });

  it("tokenizeWithPositions returns correct positions after stemming", () => {
    const map = tokenizeWithPositions("el autenticando bueno", "es");
    // "el" is ES stopword, "autenticando" stems to "autentic", "bueno" normalizes to "bueno"
    assert.ok(!map.has("el"));
    assert.deepEqual(map.get("autentic"), [1]);
    assert.deepEqual(map.get("bueno"), [2]);
  });

  it("tokenize without explicit language auto-detects Spanish", () => {
    const tokens = tokenize("cómo implementar la autenticación");
    assert.ok(!tokens.includes("cómo"));
    assert.ok(!tokens.includes("la"));
    assert.ok(tokens.includes("implement"));
    assert.ok(tokens.includes("autentic"));
  });

  it("tokenize without explicit language auto-detects English", () => {
    const tokens = tokenize("how to build authentication");
    assert.ok(!tokens.includes("how"));
    assert.ok(!tokens.includes("to"));
    assert.ok(tokens.includes("build"));
    // Simple EN stemmer strips "tion" from "authentication" → "authentica"
    assert.ok(tokens.includes("authentica"));
  });

  it("handles mixed alphanumeric with hyphens", () => {
    const tokens = tokenize("api-v2 endpoint", "en");
    assert.deepEqual(tokens, ["api-v2", "endpoint"]);
  });

  // Regression tests for review findings

  it("filters Spanish accented stopwords after NFKD normalization", () => {
    // These words have accents in the raw list but are normalized before
    // being placed into ES_STOPWORDS, so they must match post-normalization.
    assert.deepEqual(tokenize("más", "es"), []);
    assert.deepEqual(tokenize("aquí", "es"), []);
    assert.deepEqual(tokenize("después", "es"), []);
    assert.deepEqual(tokenize("éramos", "es"), []);
    assert.deepEqual(tokenize("jamás", "es"), []);
  });
});
