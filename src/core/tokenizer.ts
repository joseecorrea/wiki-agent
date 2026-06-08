// WikiAgent multilanguage tokenizer (EN / ES)
// Zero external dependencies. Inline stemmers. Auto language detection.

// ──────────────────────────────────────────────────────────
// Normalization helper (must be defined before stopword sets)
// ──────────────────────────────────────────────────────────

function normalizeUnicode(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, ""); // strip combining diacritics
}

// ──────────────────────────────────────────────────────────
// Language data
// ──────────────────────────────────────────────────────────

const EN_STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
  "of", "with", "by", "from", "is", "are", "was", "were", "be", "been",
  "being", "have", "has", "had", "do", "does", "did", "will", "would",
  "could", "should", "may", "might", "shall", "can", "need", "dare",
  "ought", "used", "it", "its", "this", "that", "these", "those",
  "i", "me", "my", "myself", "we", "our", "ours", "ourselves", "you",
  "your", "yours", "yourself", "yourselves", "he", "him", "his", "himself",
  "she", "her", "hers", "herself", "they", "them", "their", "theirs",
  "themselves", "what", "which", "who", "whom", "when", "where", "why",
  "how", "all", "each", "every", "both", "few", "more", "most", "other",
  "some", "such", "no", "nor", "not", "only", "own", "same", "so",
  "than", "too", "very", "just", "because", "as", "until", "while",
  "about", "between", "through", "during", "before", "after", "above",
  "below", "up", "down", "out", "off", "over", "under", "again",
  "further", "then", "once", "here", "there", "any", "if", "also",
  "into", "via", "etc", "eg", "ie", "vs", "let", "use", "using", "used",
  "like", "well", "get", "got", "make", "made", "go", "going",
  "went", "gone", "come", "came", "take", "took", "taken", "see", "saw",
  "seen", "know", "knew", "known", "think", "thought", "say", "said",
  "tell", "told", "find", "found", "give", "gave", "given", "new",
  "old", "first", "last", "long", "great", "little", "right", "big",
  "high", "different", "small", "large", "next", "early", "young",
  "important", "many", "much", "still", "way", "back", "even", "good",
  "want", "set", "put", "end", "another", "thing", "things", "point",
].map(normalizeUnicode));

const ES_STOPWORDS = new Set([
  "el", "la", "los", "las", "un", "una", "unos", "unas", "de", "del", "al",
  "a", "y", "o", "e", "u", "en", "con", "por", "para", "sin", "sobre",
  "entre", "desde", "hasta", "durante", "antes", "después", "según",
  "contra", "hacia", "que", "quien", "quienes", "cual", "cuales", "cuyo",
  "cuya", "cuyos", "cuyas", "como", "cuando", "donde", "cuanto",
  "este", "esta", "estos", "estas", "ese", "esa", "esos", "esas",
  "aquel", "aquella", "aquellos", "aquellas",
  "yo", "tu", "tú", "él", "ella", "nosotros", "nosotras", "vosotros",
  "vosotras", "ellos", "ellas", "me", "te", "se", "nos", "os", "lo", "la",
  "le", "les", "mi", "mis", "tu", "tus", "su", "sus", "nuestro", "nuestra",
  "nuestros", "nuestras", "vuestro", "vuestra", "vuestros", "vuestras",
  "mío", "mía", "míos", "mías", "tuyo", "tuya", "tuyos", "tuyas",
  "suyo", "suya", "suyos", "suyas",
  "ser", "soy", "eres", "es", "somos", "sois", "son", "era", "eras",
  "éramos", "erais", "eran", "fui", "fuiste", "fue", "fuimos", "fuisteis",
  "fueron", "sido", "siendo",
  "estar", "estoy", "estás", "está", "estamos", "estáis", "están",
  "estaba", "estabas", "estábamos", "estabais", "estaban",
  "estuve", "estuviste", "estuvo", "estuvimos", "estuvisteis", "estuvieron",
  "tener", "tengo", "tienes", "tiene", "tenemos", "tenéis", "tienen",
  "tenía", "tenías", "teníamos", "teníais", "tenían",
  "tuve", "tuviste", "tuvo", "tuvimos", "tuvisteis", "tuvieron",
  "haber", "he", "has", "ha", "hemos", "habéis", "han",
  "había", "habías", "habíamos", "habíais", "habían",
  "hube", "hubiste", "hubo", "hubimos", "hubisteis", "hubieron",
  "hacer", "hago", "haces", "hace", "hacemos", "hacéis", "hacen",
  "hacía", "hacías", "hacíamos", "hacíais", "hacían",
  "hice", "hiciste", "hizo", "hicimos", "hicisteis", "hicieron",
  "hecho", "haciendo",
  "poder", "puedo", "puedes", "puede", "podemos", "podéis", "pueden",
  "podía", "podías", "podíamos", "podíais", "podían",
  "pude", "pudiste", "pudo", "pudimos", "pudisteis", "pudieron",
  "decir", "digo", "dices", "dice", "decimos", "decís", "dicen",
  "dije", "dijiste", "dijo", "dijimos", "dijisteis", "dijeron",
  "diciendo", "dicho",
  "ir", "voy", "vas", "va", "vamos", "vais", "van",
  "iba", "ibas", "íbamos", "ibais", "iban",
  "ido", "yendo",
  "ver", "veo", "ves", "ve", "vemos", "veis", "ven",
  "veía", "veías", "veíamos", "veíais", "veían",
  "vi", "viste", "vio", "vimos", "visteis", "vieron", "visto", "viendo",
  "dar", "doy", "das", "da", "damos", "dais", "dan",
  "daba", "dabas", "dábamos", "dabais", "daban",
  "di", "diste", "dio", "dimos", "disteis", "dieron", "dado", "dando",
  "saber", "sé", "sabes", "sabe", "sabemos", "sabéis", "saben",
  "sabía", "sabías", "sabíamos", "sabíais", "sabían",
  "supe", "supiste", "supo", "supimos", "supisteis", "supieron",
  "sabido", "sabiendo",
  "también", "mismo", "misma", "mismos", "mismas", "otro", "otra",
  "otros", "otras", "tal", "tales", "todo", "toda", "todos", "todas",
  "muy", "más", "menos", "bien", "mal", "aquí", "ahí", "allí",
  "ahora", "antes", "después", "luego", "entonces", "siempre", "nunca",
  "jamás", "ya", "todavía", "apenas", "casi", "sólo", "solo", "sola",
  "solos", "solas", "cada", "cualquiera", "algo", "alguien", "nadie",
  "nada", "varios", "varias", "uno", "una", "dos", "tres",
].map(normalizeUnicode));

const EN_SUFFIXES: [string, number][] = [
  ["ization", 7], ["ational", 7], ["fulness", 7], ["ousness", 7],
  ["iveness", 7], ["menting", 7], ["tioning", 7],
  ["ating", 5], ["bling", 5], ["ction", 5], ["ssing", 5],
  ["ting", 4], ["ring", 4], ["ning", 4], ["sing", 4],
  ["ment", 4], ["ness", 4], ["tion", 4], ["sion", 4],
  ["able", 4], ["ible", 4], ["ful", 3], ["ity", 3],
  ["ive", 3], ["ous", 3], ["ion", 3], ["ing", 3],
  ["ies", 3], ["ed", 2], ["er", 2], ["ly", 2],
  ["al", 2], ["es", 2], ["ty", 2],
];

// Snowball-style Spanish suffix stemmer (inline, no deps)
// Ordered from longest to shortest for greedy matching.
const ES_SUFFIXES: [string, number][] = [
  // Long derivational / inflectional
  ["izaciones", 9], ["izacion", 7],
  ["aciones", 7], ["acion", 5],
  ["imientos", 8], ["imiento", 7],
  ["idades", 6], ["idad", 4],
  ["adores", 6], ["adoras", 6], ["adora", 5], ["ador", 4],
  ["anzas", 5], ["anza", 4],
  ["ables", 5], ["ible", 4], ["able", 4], ["ble", 3],
  ["mente", 5],
  ["ciones", 6], ["cion", 4],
  ["siones", 6], ["sion", 4],
  ["itas", 4], ["itos", 4], ["ita", 3], ["ito", 3],
  // Verbal / participial
  ["ando", 4], ["iendo", 5], ["yendo", 5],
  ["aron", 4], ["eran", 4], ["iran", 4],
  ["ados", 4], ["ido", 3], ["ado", 3],
  // Conjugation / infinitive endings
  ["ar", 2], ["er", 2], ["ir", 2],
  // Plural
  ["es", 2], ["s", 1],
];

// ──────────────────────────────────────────────────────────
// Language detection
// ──────────────────────────────────────────────────────────

function countTokens(text: string, set: Set<string>): number {
  let count = 0;
  for (const w of text.split(/\s+/)) {
    if (set.has(w)) count++;
  }
  return count;
}

const EN_DETECTION_SUFFIXES = /\b\w+(ing|tion|sion|ness|ment|ly|ed|er|able|ible|ive|ous|ful|ity|ism|ist|ize|ise)\b/i;

export function detectLanguage(text: string): "es" | "en" {
  const sample = text.toLowerCase();

  // Fast path: Spanish-specific characters
  if (/[áéíóúñü]/.test(sample)) {
    return "es";
  }

  // Heuristic: compare stopword density
  const esScore = countTokens(sample, ES_STOPWORDS);
  const enScore = countTokens(sample, EN_STOPWORDS);

  if (esScore === 0 && enScore === 0) {
    // No stopwords found; look for typical English word endings
    return EN_DETECTION_SUFFIXES.test(sample) ? "en" : "es";
  }

  return esScore >= enScore ? "es" : "en";
}

// ──────────────────────────────────────────────────────────
// Normalization
// ──────────────────────────────────────────────────────────

function normalizeEN(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ");
}

function normalizeES(text: string): string {
  // Unicode-aware after NFKD diacritic stripping
  return normalizeUnicode(text)
    .replace(/[^\p{L}\p{N}\s-]/gu, " "); // keep letters (any script) + digits + spaces + hyphen
}

// ──────────────────────────────────────────────────────────
// Stemming
// ──────────────────────────────────────────────────────────

function stemEN(word: string): string {
  if (word.length <= 3) return word;
  for (const [suffix, len] of EN_SUFFIXES) {
    if (word.length > len + 2 && word.endsWith(suffix)) {
      return word.slice(0, -len);
    }
  }
  if (word.endsWith("s") && word.length > 3 && !word.endsWith("ss")) {
    return word.slice(0, -1);
  }
  return word;
}

function stemES(word: string): string {
  if (word.length <= 3) return word;
  for (const [suffix, len] of ES_SUFFIXES) {
    // Spanish words tend to be longer; allow a 2-char stem (vs 3-char for EN)
    if (word.length > len + 1 && word.endsWith(suffix)) {
      return word.slice(0, -len);
    }
  }
  return word;
}

// ──────────────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────────────

export function tokenize(text: string, language?: "es" | "en"): string[] {
  const lang = language ?? detectLanguage(text);
  const normalizer = lang === "es" ? normalizeES : normalizeEN;
  const stemmer = lang === "es" ? stemES : stemEN;
  const stopwords = lang === "es" ? ES_STOPWORDS : EN_STOPWORDS;

  const words = normalizer(text)
    .split(/\s+/)
    .filter((w) => w.length > 1);

  const tokens: string[] = [];
  for (const word of words) {
    if (stopwords.has(word)) continue;
    tokens.push(stemmer(word));
  }
  return tokens;
}

export function tokenizeWithPositions(
  text: string,
  language?: "es" | "en",
): Map<string, number[]> {
  const lang = language ?? detectLanguage(text);
  const normalizer = lang === "es" ? normalizeES : normalizeEN;
  const stemmer = lang === "es" ? stemES : stemEN;
  const stopwords = lang === "es" ? ES_STOPWORDS : EN_STOPWORDS;

  const words = normalizer(text)
    .split(/\s+/)
    .filter((w) => w.length > 1);

  const result = new Map<string, number[]>();
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (stopwords.has(word)) continue;
    const token = stemmer(word);
    const positions = result.get(token) ?? [];
    positions.push(i);
    result.set(token, positions);
  }
  return result;
}
