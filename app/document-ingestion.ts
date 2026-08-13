import type { CaseDoc, CorpusChunk, Topic } from "./talqs-data";
import {
  chunkCorpus,
  defaultEngineOptions,
  extractiveSummary,
  type ChunkingStrategy,
} from "./retrieval-lab";

export type ExtractedFile = {
  text: string;
  pageCount: number;
  fileName: string;
};

const MAX_FILE_BYTES = 12 * 1024 * 1024;

export function cleanDocumentText(value: string) {
  return value
    .replaceAll(String.fromCharCode(0), "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

async function extractPdf(file: File) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  if (!pdfjs.GlobalWorkerOptions.workerPort && typeof Worker !== "undefined") {
    pdfjs.GlobalWorkerOptions.workerPort = new Worker(
      new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url),
      { type: "module" },
    );
  }

  const document = await pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    isEvalSupported: false,
  }).promise;
  const pages: string[] = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .trim();
    if (text) pages.push(`Page ${pageNumber}\n${text}`);
  }

  return { text: pages.join("\n\n"), pageCount: document.numPages };
}

export async function extractFile(file: File): Promise<ExtractedFile> {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error("The file exceeds the 12 MB session-upload limit.");
  }

  const extension = file.name.split(".").pop()?.toLowerCase();
  const isPdf = file.type === "application/pdf" || extension === "pdf";
  const isText =
    file.type.startsWith("text/") || extension === "txt" || extension === "md";

  if (!isPdf && !isText) {
    throw new Error("Use a searchable PDF, TXT, or Markdown file for this build.");
  }

  const extracted = isPdf
    ? await extractPdf(file)
    : { text: await file.text(), pageCount: 1 };
  const text = cleanDocumentText(extracted.text);

  if (text.length < 250) {
    throw new Error(
      "Too little searchable text was found. Scanned PDFs need OCR before this prototype can index them.",
    );
  }

  return { text, pageCount: extracted.pageCount, fileName: file.name };
}

function detectTitle(text: string, fileName: string) {
  const firstUsefulLine = text
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length >= 12 && line.length <= 150 && !/^page \d+$/i.test(line));
  return firstUsefulLine ?? fileName.replace(/\.[^.]+$/, "");
}

function detectForum(text: string) {
  const candidates = [
    /national consumer disputes redressal commission[^\n.]*/i,
    /state consumer disputes redressal commission[^\n.]*/i,
    /district consumer disputes redressal commission[^\n.]*/i,
    /district consumer forum[^\n.]*/i,
  ];
  const match = candidates.map((pattern) => text.match(pattern)?.[0]).find(Boolean);
  return match ? match.replace(/\s+/g, " ").trim() : "Forum not detected";
}

function detectLevel(forum: string): CaseDoc["level"] {
  const normalized = forum.toLowerCase();
  if (normalized.includes("national")) return "National";
  if (normalized.includes("state")) return "State";
  if (normalized.includes("district")) return "District";
  return "Unknown";
}

function detectTopicsForSummary(summary: string[]): Record<Topic, string> {
  const fallback =
    summary.join(" ") || "The uploaded document does not contain enough extracted text.";
  return {
    facts: fallback,
    outcome: fallback,
    remedy: fallback,
    law: fallback,
  };
}

export function createSessionDocument(
  extracted: ExtractedFile,
  strategy: Exclude<ChunkingStrategy, "curated"> = "sentence",
  chunkSize = defaultEngineOptions.chunkSize,
  overlap = defaultEngineOptions.overlap,
): CaseDoc {
  const title = detectTitle(extracted.text, extracted.fileName);
  const forum = detectForum(extracted.text);
  const summary = extractiveSummary(extracted.text);
  const base: CaseDoc = {
    id: `upload-${Date.now()}`,
    title,
    shortTitle: title.length > 48 ? `${title.slice(0, 45)}...` : title,
    forum,
    decisionDate: new Date().toISOString().slice(0, 10),
    level: detectLevel(forum),
    platform: "Uploaded record",
    category: "Session document",
    posture: "Not determined automatically",
    disposition: "Use retrieved passages; no automatic merits determination.",
    sourceUrl: "",
    sourceNote:
      "Processed in this browser session. The text, metadata, and extractive preview have not been manually verified and are not saved to a database.",
    officialLookupUrl: "",
    summary,
    qa: detectTopicsForSummary(summary),
    chunks: [] as CorpusChunk[],
    origin: "session-upload",
    rawText: extracted.text,
    pageCount: extracted.pageCount,
  };

  base.chunks = chunkCorpus(base, strategy, chunkSize, overlap).map((chunk, index) => ({
    ...chunk,
    id: `UP-${String(index + 1).padStart(3, "0")}`,
    sourceLabel: `${extracted.fileName}${extracted.pageCount > 1 ? " (extracted PDF)" : ""}`,
  }));
  return base;
}
