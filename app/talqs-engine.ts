import { cases, statutoryChunks, type CaseDoc, type CorpusChunk, type Topic } from "./talqs-data";
import {
  chunkCorpus,
  combinedScore,
  defaultEngineOptions,
  scoreChunks,
  type EngineOptions,
  type ScoreBreakdown,
} from "./retrieval-lab";

export type TopicResult = Topic | "unsupported";

export type RetrievalHit = CorpusChunk & {
  score: number;
  reason: string;
  scoreBreakdown: ScoreBreakdown;
};

export type TalqsAnswer = {
  caseId: string;
  question: string;
  classifiedTopic: TopicResult;
  answer: string;
  status: "answered" | "no-answer";
  hits: RetrievalHit[];
  candidateCount: number;
  supportScore: number;
  options: EngineOptions;
  promptPreview: string;
  sanitizedRequest: Record<string, unknown>;
  sanitizedResponse: Record<string, unknown>;
  timings: {
    classifyMs: number;
    chunkMs: number;
    retrievalMs: number;
    composeMs: number;
    totalMs: number;
  };
  tokenEstimate: {
    inputTokens: number;
    outputTokens: number;
    method: string;
  };
  fallbackReason?: string;
};

const promptTemplateVersion = "talqs-grounded-v0.8";

const topicLabels: Record<Topic, string> = {
  facts: "key facts",
  outcome: "final outcome",
  remedy: "remedy granted",
  law: "statutory or procedural point",
};

const topicKeywords: Record<Topic, string[]> = {
  facts: [
    "fact",
    "facts",
    "background",
    "what happened",
    "story",
    "purchase",
    "order",
    "defect",
    "wrong",
    "delivered",
  ],
  outcome: [
    "outcome",
    "result",
    "held",
    "decided",
    "decision",
    "dismissed",
    "allowed",
    "upheld",
    "final",
  ],
  remedy: [
    "remedy",
    "relief",
    "compensation",
    "refund",
    "interest",
    "cost",
    "costs",
    "granted",
    "award",
    "ordered",
  ],
  law: [
    "law",
    "section",
    "statutory",
    "procedure",
    "procedural",
    "jurisdiction",
    "appeal",
    "intermediary",
    "safe harbour",
    "e-commerce",
    "consumer protection",
  ],
};

const blockedAdviceKeywords = [
  "should i",
  "can i file",
  "draft",
  "notice",
  "lawyer",
  "advise",
  "advice",
  "strategy",
  "chances",
  "win",
  "court fee",
  "limitation for me",
  "tomorrow",
  "my case",
  "what should",
];

function now() {
  return typeof performance === "undefined" ? Date.now() : performance.now();
}

function estimateTokens(value: string): number {
  return Math.max(1, Math.ceil(value.length / 4));
}

function describeHit(hit: RetrievalHit, method: EngineOptions["retrievalMethod"]) {
  const mainScore =
    method === "keyword"
      ? `keyword ${hit.scoreBreakdown.keyword}`
      : method === "bm25"
        ? `BM25 ${hit.scoreBreakdown.bm25}`
        : method === "tfidf"
          ? `TF-IDF ${hit.scoreBreakdown.tfidf}`
          : `hybrid K:${hit.scoreBreakdown.keyword} B:${hit.scoreBreakdown.bm25} T:${hit.scoreBreakdown.tfidf}`;
  return `${mainScore}${hit.scoreBreakdown.topicBoost ? "; intent tag matched" : ""}`;
}

function composeExtractiveAnswer(topic: Topic, hits: RetrievalHit[]) {
  const labels: Record<Topic, string> = {
    facts: "The strongest passages for the key facts state",
    outcome: "The strongest passages for the outcome state",
    remedy: "The strongest passages for the remedy state",
    law: "The strongest passages for the legal or procedural point state",
  };
  const passages = hits
    .slice(0, 2)
    .map((hit) => `[${hit.id}] ${hit.text.slice(0, 420).trim()}`)
    .join(" ");
  return `${labels[topic]}: ${passages}`;
}

function buildPrompt(document: CaseDoc, question: string, topic: TopicResult, hits: RetrievalHit[]) {
  const passages = hits.length
    ? hits.map((hit) => `[${hit.id}] ${hit.text}`).join("\n\n")
    : "No passage cleared the retrieval stage.";

  return [
    `TEMPLATE ${promptTemplateVersion}`,
    "ROLE: Research assistant for a narrow Indian consumer-dispute corpus.",
    "RULES:",
    "- Answer only the allowed question type and only from the supplied passages.",
    "- Cite every factual statement with a supplied chunk id in square brackets.",
    "- Do not provide personal legal advice, predictions, filing strategy, or uncited law.",
    "- If the passages are insufficient, return: NOT ENOUGH SUPPORT.",
    `DOCUMENT: ${document.title}`,
    `INTENT: ${topicLabel(topic)}`,
    `QUESTION: ${question.trim()}`,
    "PASSAGES:",
    passages,
  ].join("\n");
}

export function getCase(caseId: string): CaseDoc {
  return cases.find((item) => item.id === caseId) ?? cases[0];
}

export function classifyQuestion(question: string): TopicResult {
  const normalized = question.trim().toLowerCase();
  if (!normalized) return "unsupported";

  if (blockedAdviceKeywords.some((keyword) => normalized.includes(keyword))) {
    return "unsupported";
  }

  const scores = Object.entries(topicKeywords).map(([topic, keywords]) => {
    const score = keywords.reduce(
      (sum, keyword) =>
        normalized.includes(keyword) ? sum + keyword.split(" ").length : sum,
      0,
    );
    return { topic: topic as Topic, score };
  });

  scores.sort((left, right) => right.score - left.score);
  return scores[0].score > 0 ? scores[0].topic : "unsupported";
}

export function retrieveDocument(
  document: CaseDoc,
  topic: TopicResult,
  question: string,
  options: EngineOptions,
) {
  if (topic === "unsupported") {
    return { hits: [] as RetrievalHit[], candidateCount: 0, chunkMs: 0 };
  }

  const chunkStarted = now();
  const documentChunks = chunkCorpus(
    document,
    options.chunkingStrategy,
    options.chunkSize,
    options.overlap,
  );
  const candidates = [
    ...documentChunks,
    ...(options.includeStatutes && (topic === "law" || topic === "remedy")
      ? statutoryChunks
      : []),
  ];
  const chunkMs = now() - chunkStarted;
  const scored = scoreChunks(candidates, question, topic)
    .map(({ chunk, breakdown }) => {
      const score = combinedScore(breakdown, options.retrievalMethod);
      const hit: RetrievalHit = {
        ...chunk,
        score,
        scoreBreakdown: breakdown,
        reason: "",
      };
      hit.reason = describeHit(hit, options.retrievalMethod);
      return hit;
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, options.topK);

  return { hits: scored, candidateCount: candidates.length, chunkMs };
}

export function answerDocument(
  document: CaseDoc,
  question: string,
  partialOptions: Partial<EngineOptions> = {},
): TalqsAnswer {
  const options = { ...defaultEngineOptions, ...partialOptions };
  const started = now();
  const classifyStart = now();
  const classifiedTopic = classifyQuestion(question);
  const classifyMs = now() - classifyStart;

  const retrievalStart = now();
  const retrieval = retrieveDocument(document, classifiedTopic, question, options);
  const retrievalMs = now() - retrievalStart;
  const supportScore = retrieval.hits[0]?.score ?? 0;

  const composeStart = now();
  const unsupportedIntent = classifiedTopic === "unsupported" || !question.trim();
  const enoughSupport = !unsupportedIntent && supportScore >= options.threshold;
  const answer = !enoughSupport
    ? "TALQS cannot answer that from the selected record. Ask about key facts, final outcome, remedy granted, or a statutory or procedural point that is supported by retrieved passages."
    : document.origin === "session-upload"
      ? composeExtractiveAnswer(classifiedTopic, retrieval.hits)
      : document.qa[classifiedTopic];
  const composeMs = now() - composeStart;
  const promptPreview = buildPrompt(document, question, classifiedTopic, retrieval.hits);
  const totalMs = now() - started;

  const fallbackReason = !enoughSupport
    ? unsupportedIntent
      ? "The question is outside the four allowed research intents or asks for personal legal advice."
      : `Top retrieval score ${supportScore.toFixed(2)} is below the ${options.threshold.toFixed(2)} support threshold.`
    : undefined;
  const requestPayload = {
    documentId: document.id,
    documentOrigin: document.origin ?? "curated",
    question: question.trim(),
    allowedTopics: Object.values(topicLabels),
    mode: "deterministic-retrieval",
    promptTemplateVersion,
    retrieval: options,
    apiKeyIncluded: false,
  };
  const responsePayload = {
    status: enoughSupport ? "answered" : "no-answer",
    classifiedTopic,
    answer,
    supportScore,
    threshold: options.threshold,
    candidateCount: retrieval.candidateCount,
    citationChunkIds: enoughSupport ? retrieval.hits.map((hit) => hit.id) : [],
    fallbackReason,
  };

  return {
    caseId: document.id,
    question,
    classifiedTopic,
    answer,
    status: enoughSupport ? "answered" : "no-answer",
    hits: retrieval.hits,
    candidateCount: retrieval.candidateCount,
    supportScore,
    options,
    promptPreview,
    sanitizedRequest: requestPayload,
    sanitizedResponse: responsePayload,
    timings: {
      classifyMs,
      chunkMs: retrieval.chunkMs,
      retrievalMs,
      composeMs,
      totalMs,
    },
    tokenEstimate: {
      inputTokens: estimateTokens(promptPreview),
      outputTokens: estimateTokens(answer),
      method: "character-count estimate; no external model call unless BYOK is run manually",
    },
    fallbackReason,
  };
}

export function answerQuestion(
  caseId: string,
  question: string,
  options: Partial<EngineOptions> = {},
) {
  return answerDocument(getCase(caseId), question, options);
}

export function validateModelOutput(output: string, hits: RetrievalHit[]) {
  const allowedIds = new Set(hits.map((hit) => hit.id));
  const citedIds = [...output.matchAll(/\[([A-Za-z0-9-]+)\]/g)].map((match) => match[1]);
  const unsupportedIds = citedIds.filter((id) => !allowedIds.has(id));

  if (!output.trim()) return { valid: false, reason: "The provider returned an empty response." };
  if (output.includes("NOT ENOUGH SUPPORT")) {
    return { valid: false, reason: "The model judged the supplied passages insufficient." };
  }
  if (!citedIds.length) return { valid: false, reason: "The model response contains no chunk citation." };
  if (unsupportedIds.length) {
    return {
      valid: false,
      reason: `The response cited chunks that were not supplied: ${unsupportedIds.join(", ")}.`,
    };
  }
  return { valid: true, reason: "All cited chunk ids were present in the retrieved context." };
}

export function formatMs(value: number): string {
  return `${Math.max(0.1, value).toFixed(1)} ms`;
}

export function topicLabel(topic: TopicResult): string {
  return topic === "unsupported" ? "unsupported question" : topicLabels[topic];
}
