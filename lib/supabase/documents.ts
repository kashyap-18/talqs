import { getSupabaseBrowserClient } from "./client";
import type { CaseDoc, CorpusChunk, Topic } from "@/app/talqs-data";

type DocumentRow = {
  id: string;
  title: string;
  file_name: string;
  mime_type: string;
  page_count: number;
  chunking_strategy: "paragraph" | "sentence" | "fixed";
  chunk_size: number;
  overlap: number;
  chunk_count: number;
  status: "processing" | "ready" | "failed";
  created_at: string;
};

type ChunkRow = {
  id: number;
  document_id: string;
  chunk_index: number;
  content: string;
};

export type SemanticHit = {
  id: number;
  document_id: string;
  chunk_index: number;
  content: string;
  similarity: number;
};

export type SemanticSearchResult = {
  hits: SemanticHit[];
  embeddingModel: string;
  dimensions: number;
  threshold: number;
  topK: number;
  timings: { embeddingMs: number; retrievalMs: number; totalMs: number };
  fallback: boolean;
};

function summaryFromChunks(chunks: ChunkRow[]) {
  const text = chunks
    .slice(0, 3)
    .map((chunk) => chunk.content.trim())
    .join(" ")
    .slice(0, 1100);
  return text ? [text] : ["No stored text is available for this document."];
}

function topics(summary: string[]): Record<Topic, string> {
  const value = summary.join(" ");
  return { facts: value, outcome: value, remedy: value, law: value };
}

function toCaseDocument(document: DocumentRow, rows: ChunkRow[]): CaseDoc {
  const ordered = rows
    .filter((row) => row.document_id === document.id)
    .sort((left, right) => left.chunk_index - right.chunk_index);
  const summary = summaryFromChunks(ordered);
  const chunks: CorpusChunk[] = ordered.map((row) => ({
    id: `DB-${row.id}`,
    title: document.title,
    topic: ["facts", "outcome", "remedy", "law"],
    text: row.content,
    sourceLabel: `${document.file_name} · stored chunk ${row.chunk_index + 1}`,
    sourceUrl: "",
  }));

  return {
    id: document.id,
    title: document.title,
    shortTitle: document.title.length > 48 ? `${document.title.slice(0, 45)}...` : document.title,
    forum: "Forum not verified",
    decisionDate: document.created_at.slice(0, 10),
    level: "Unknown",
    platform: "Private library",
    category: "Stored document",
    posture: "Not determined automatically",
    disposition: "Use retrieved passages; no automatic merits determination.",
    sourceUrl: "",
    sourceNote:
      `Stored in the signed-in user's private Supabase library. ${document.chunk_count} chunks were embedded with gte-small and indexed in pgvector.`,
    officialLookupUrl: "",
    summary,
    qa: topics(summary),
    chunks,
    origin: "stored-upload",
    pageCount: document.page_count,
  };
}

export async function loadStoredDocuments() {
  const client = getSupabaseBrowserClient();
  if (!client) throw new Error("Supabase is not configured.");
  const { data: documents, error: documentError } = await client
    .from("documents")
    .select("id, title, file_name, mime_type, page_count, chunking_strategy, chunk_size, overlap, chunk_count, status, created_at")
    .eq("status", "ready")
    .order("created_at", { ascending: false });
  if (documentError) throw new Error("Stored documents could not be loaded.");
  if (!documents?.length) return [] as CaseDoc[];

  const { data: chunks, error: chunksError } = await client
    .from("document_chunks")
    .select("id, document_id, chunk_index, content")
    .in("document_id", documents.map((document) => document.id))
    .order("chunk_index", { ascending: true });
  if (chunksError) throw new Error("Stored document chunks could not be loaded.");
  return (documents as DocumentRow[]).map((document) =>
    toCaseDocument(document, (chunks ?? []) as ChunkRow[]),
  );
}

export async function persistDocument(
  document: CaseDoc,
  file: File,
  options: { chunkingStrategy: string; chunkSize: number; overlap: number },
) {
  const client = getSupabaseBrowserClient();
  if (!client) throw new Error("Supabase is not configured.");
  const { data, error } = await client.functions.invoke("ingest-document", {
    body: {
      document: {
        title: document.title,
        fileName: file.name,
        mimeType:
          file.type === "application/pdf"
            ? "application/pdf"
            : file.name.toLowerCase().endsWith(".md")
              ? "text/markdown"
              : "text/plain",
        pageCount: document.pageCount ?? 1,
        chunkingStrategy: options.chunkingStrategy,
        chunkSize: options.chunkSize,
        overlap: options.overlap,
      },
      chunks: document.chunks.map((chunk) => ({ content: chunk.text })),
    },
  });
  if (error) throw new Error(error.message || "Document storage failed.");
  return data as { documentId: string; chunkCount: number; embeddingModel: string; dimensions: number };
}

export async function deleteStoredDocument(documentId: string) {
  const client = getSupabaseBrowserClient();
  if (!client) throw new Error("Supabase is not configured.");
  const { error } = await client.from("documents").delete().eq("id", documentId);
  if (error) throw new Error("The document could not be deleted.");
}

export async function searchStoredDocument(
  documentId: string,
  query: string,
  options: { threshold: number; topK: number },
) {
  const client = getSupabaseBrowserClient();
  if (!client) throw new Error("Supabase is not configured.");
  const { data, error } = await client.functions.invoke("search-document", {
    body: { documentId, query, ...options },
  });
  if (error) throw new Error(error.message || "Semantic retrieval failed.");
  return data as SemanticSearchResult;
}

