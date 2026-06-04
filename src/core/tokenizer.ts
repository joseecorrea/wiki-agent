const STOPWORDS = new Set([
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
  "like", "well", "also", "get", "got", "make", "made", "go", "going",
  "went", "gone", "come", "came", "take", "took", "taken", "see", "saw",
  "seen", "know", "knew", "known", "think", "thought", "say", "said",
  "tell", "told", "find", "found", "give", "gave", "given", "new",
  "old", "first", "last", "long", "great", "little", "right", "big",
  "high", "different", "small", "large", "next", "early", "young",
  "important", "many", "much", "still", "way", "back", "even", "good",
  "want", "set", "put", "end", "another", "thing", "things", "point",
]);

const SUFFIXES: [string, number][] = [
  ["ization", 7], ["ational", 7], ["fulness", 7], ["ousness", 7],
  ["iveness", 7], ["menting", 7],
  ["ational", 7], ["tioning", 7],
  ["ating", 5], ["bling", 5], ["ction", 5], ["ssing", 5],
  ["ting", 4], ["ring", 4], ["ning", 4], ["sing", 4],
  ["ment", 4], ["ness", 4], ["tion", 4], ["sion", 4],
  ["able", 4], ["ible", 4], ["ful", 3], ["ity", 3],
  ["ive", 3], ["ous", 3], ["ion", 3], ["ing", 3],
  ["ies", 3], ["ed", 2], ["er", 2], ["ly", 2],
  ["al", 2], ["es", 2], ["ty", 2],
];

function stem(word: string): string {
  if (word.length <= 3) return word;
  for (const [suffix, len] of SUFFIXES) {
    if (word.length > len + 2 && word.endsWith(suffix)) {
      return word.slice(0, -len);
    }
  }
  if (word.endsWith("s") && word.length > 3 && !word.endsWith("ss")) {
    return word.slice(0, -1);
  }
  return word;
}

export function tokenize(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1);

  const tokens: string[] = [];
  for (const word of words) {
    if (STOPWORDS.has(word)) continue;
    tokens.push(stem(word));
  }
  return tokens;
}

export function tokenizeWithPositions(text: string): Map<string, number[]> {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1);

  const result = new Map<string, number[]>();
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (STOPWORDS.has(word)) continue;
    const token = stem(word);
    const positions = result.get(token) ?? [];
    positions.push(i);
    result.set(token, positions);
  }
  return result;
}