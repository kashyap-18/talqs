import type { CaseDoc, CorpusChunk, Topic } from "./talqs-data";

export type RetrievalMethod = "keyword" | "bm25" | "tfidf" | "hybrid";
export type ChunkingStrategy = "curated" | "paragraph" | "sentence" | "fixed";

export type EngineOptions = {
  retrievalMethod: RetrievalMethod;
  chunkingStrategy: ChunkingStrategy;
  chunkSize: number;
  overlap: number;
  topK: number;
  threshold: number;
  includeStatutes: boolean;
};

export type ScoreBreakdown = {
  keyword: number;
  bm25: number;
  tfidf: number;
  topicBoost: number;
};

export const defaultEngineOptions: EngineOptions = {
  retrievalMethod: "hybrid",
  chunkingStrategy: "curated",
  chunkSize: 120,
  overlap: 24,
  topK: 4,
  threshold: 0.2,
  includeStatutes: true,
};

const stopWords = new Set([
  "about",
  "after",
  "again",
  "also",
  "and",
  "are",
  "been",
  "before",
  "being",
  "between",
  "case",
  "could",
  "does",
  "from",
  "had",
  "has",
  "have",
  "into",
  "its",
  "only",
  "order",
  "that",
  "the",
  "their",
  "there",
  "this",
  "was",
  "were",
  "what",
  "when",
  "which",
  "with",
  "would",
]);

const intentTerms: Record<Topic, string[]> = {
  facts: ["facts", "background", "purchase", "complainant", "product", "defect", "delivery"],
  outcome: ["outcome", "held", "decision", "dismissed", "allowed", "appeal", "final"],
  remedy: ["remedy", "relief", "refund", "replace", "compensation", "interest", "costs"],
  law: ["section", "act", "rules", "jurisdiction", "procedure", "statutory", "commission"],
};

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}

export function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((token) => token.replace(/^-+|-+$/g, ""))
    .filter((token) => token.length > 2 && !stopWords.has(token));
}

function splitSentences(value: string): string[] {
  return (value.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [])
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 20);
}

export function inferTopics(value: string): Topic[] {
  const normalized = value.toLowerCase();
  const matches = (Object.entries(intentTerms) as [Topic, string[]][])
    .filter(([, terms]) => terms.some((term) => normalized.includes(term)))
    .map(([topic]) => topic);

  return matches.length ? matches : ["facts"];
}

function makeChunk(
  source: CorpusChunk,
  text: string,
  index: number,
  suffix: string,
): CorpusChunk {
  return {
    ...source,
    id: `${source.id}-${suffix}${String(index + 1).padStart(2, "0")}`,
    text: text.trim(),
    topic: inferTopics(text),
  };
}

function wordWindows(source: CorpusChunk, size: number, overlap: number): CorpusChunk[] {
  const words = source.text.split(/\s+/).filter(Boolean);
  const safeSize = Math.max(40, size);
  const step = Math.max(20, safeSize - Math.min(overlap, safeSize - 20));
  const chunks: CorpusChunk[] = [];

  for (let start = 0; start < words.length; start += step) {
    const text = words.slice(start, start + safeSize).join(" ");
    if (text.length > 30) chunks.push(makeChunk(source, text, chunks.length, "W"));
    if (start + safeSize >= words.length) break;
  }

  return chunks;
}

function sentenceWindows(source: CorpusChunk, size: number, overlap: number): CorpusChunk[] {
  const sentences = splitSentences(source.text);
  if (sentences.length < 2) return [makeChunk(source, source.text, 0, "S")];

  const chunks: CorpusChunk[] = [];
  let buffer: string[] = [];
  let wordCount = 0;

  for (const sentence of sentences) {
    const sentenceWords = sentence.split(/\s+/).length;
    if (buffer.length && wordCount + sentenceWords > size) {
      chunks.push(makeChunk(source, buffer.join(" "), chunks.length, "S"));
      const retained: string[] = [];
      let retainedWords = 0;
      for (let index = buffer.length - 1; index >= 0 && retainedWords < overlap; index -= 1) {
        retained.unshift(buffer[index]);
        retainedWords += buffer[index].split(/\s+/).length;
      }
      buffer = retained;
      wordCount = retainedWords;
    }
    buffer.push(sentence);
    wordCount += sentenceWords;
  }

  if (buffer.length) chunks.push(makeChunk(source, buffer.join(" "), chunks.length, "S"));
  return chunks;
}

export function chunkCorpus(
  document: CaseDoc,
  strategy: ChunkingStrategy,
  size: number,
  overlap: number,
): CorpusChunk[] {
  if (strategy === "curated") return document.chunks;

  const sources = document.rawText
    ? [
        {
          id: document.origin === "session-upload" ? "UPLOAD" : "DOC",
          title: document.title,
          topic: ["facts" as Topic],
          text: document.rawText,
          sourceLabel:
            document.origin === "session-upload" ? "Session upload" : document.shortTitle,
          sourceUrl: document.sourceUrl,
        },
      ]
    : document.chunks;

  if (strategy === "fixed") {
    return sources.flatMap((source) => wordWindows(source, size, overlap));
  }

  if (strategy === "sentence") {
    return sources.flatMap((source) => sentenceWindows(source, size, overlap));
  }

  return sources.flatMap((source) => {
    const paragraphs = source.text
      .split(/\n\s*\n/)
      .map((paragraph) => paragraph.trim())
      .filter((paragraph) => paragraph.length > 30);
    return (paragraphs.length ? paragraphs : [source.text]).map((paragraph, index) =>
      makeChunk(source, paragraph, index, "P"),
    );
  });
}

function termFrequency(tokens: string[]) {
  const counts = new Map<string, number>();
  tokens.forEach((token) => counts.set(token, (counts.get(token) ?? 0) + 1));
  return counts;
}

function cosine(left: Map<string, number>, right: Map<string, number>) {
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;
  left.forEach((value, term) => {
    dot += value * (right.get(term) ?? 0);
    leftMagnitude += value * value;
  });
  right.forEach((value) => {
    rightMagnitude += value * value;
  });
  return leftMagnitude && rightMagnitude ? dot / Math.sqrt(leftMagnitude * rightMagnitude) : 0;
}

function normalize(values: number[]) {
  const max = Math.max(...values, 0);
  return max ? values.map((value) => value / max) : values.map(() => 0);
}

export function scoreChunks(chunks: CorpusChunk[], question: string, topic: Topic) {
  const queryTokens = tokenize(`${question} ${intentTerms[topic].join(" ")}`);
  const uniqueQuery = new Set(queryTokens);
  const tokenizedChunks = chunks.map((chunk) => tokenize(`${chunk.title} ${chunk.text}`));
  const documentFrequency = new Map<string, number>();

  tokenizedChunks.forEach((tokens) => {
    new Set(tokens).forEach((term) =>
      documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1),
    );
  });

  const averageLength =
    tokenizedChunks.reduce((total, tokens) => total + tokens.length, 0) /
    Math.max(1, tokenizedChunks.length);

  const keywordRaw = tokenizedChunks.map((tokens) => {
    const terms = new Set(tokens);
    const matches = [...uniqueQuery].filter((term) => terms.has(term)).length;
    return matches / Math.max(1, uniqueQuery.size);
  });

  const bm25Raw = tokenizedChunks.map((tokens) => {
    const counts = termFrequency(tokens);
    return [...uniqueQuery].reduce((score, term) => {
      const frequency = counts.get(term) ?? 0;
      if (!frequency) return score;
      const containing = documentFrequency.get(term) ?? 0;
      const idf = Math.log(1 + (chunks.length - containing + 0.5) / (containing + 0.5));
      const denominator =
        frequency + 1.2 * (1 - 0.75 + 0.75 * (tokens.length / Math.max(1, averageLength)));
      return score + idf * ((frequency * 2.2) / denominator);
    }, 0);
  });

  const queryFrequency = termFrequency(queryTokens);
  const queryVector = new Map<string, number>();
  queryFrequency.forEach((frequency, term) => {
    const idf = Math.log((chunks.length + 1) / ((documentFrequency.get(term) ?? 0) + 1)) + 1;
    queryVector.set(term, frequency * idf);
  });

  const tfidfRaw = tokenizedChunks.map((tokens) => {
    const vector = new Map<string, number>();
    termFrequency(tokens).forEach((frequency, term) => {
      const idf = Math.log((chunks.length + 1) / ((documentFrequency.get(term) ?? 0) + 1)) + 1;
      vector.set(term, frequency * idf);
    });
    return cosine(queryVector, vector);
  });

  const keyword = normalize(keywordRaw);
  const bm25 = normalize(bm25Raw);
  const tfidf = normalize(tfidfRaw);

  return chunks.map((chunk, index) => ({
    chunk,
    breakdown: {
      keyword: round(keyword[index]),
      bm25: round(bm25[index]),
      tfidf: round(tfidf[index]),
      topicBoost: chunk.topic.includes(topic) ? 0.08 : 0,
    } satisfies ScoreBreakdown,
  }));
}

export function combinedScore(breakdown: ScoreBreakdown, method: RetrievalMethod) {
  const base =
    method === "keyword"
      ? breakdown.keyword
      : method === "bm25"
        ? breakdown.bm25
        : method === "tfidf"
          ? breakdown.tfidf
          : breakdown.keyword * 0.2 + breakdown.bm25 * 0.45 + breakdown.tfidf * 0.35;
  return round(Math.min(1, base + breakdown.topicBoost));
}

export function extractiveSummary(value: string): string[] {
  const sentences = splitSentences(value).filter((sentence) => sentence.length < 420);
  const legalTerms = [
    "complainant",
    "consumer",
    "purchased",
    "ordered",
    "defect",
    "refund",
    "commission",
    "dismissed",
    "allowed",
    "directed",
  ];
  const ranked = sentences
    .map((sentence, index) => ({
      sentence,
      index,
      score: legalTerms.filter((term) => sentence.toLowerCase().includes(term)).length,
    }))
    .sort((left, right) => right.score - left.score || left.index - right.index);

  const selected = ranked.slice(0, 3).sort((left, right) => left.index - right.index);
  return selected.length
    ? selected.map((item) => item.sentence)
    : [value.slice(0, 500).trim()].filter(Boolean);
}
