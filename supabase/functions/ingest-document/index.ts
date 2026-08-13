import { createClient } from "npm:@supabase/supabase-js@2.112.3";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

type IngestRequest = {
  document?: {
    title?: string;
    fileName?: string;
    mimeType?: string;
    pageCount?: number;
    chunkingStrategy?: string;
    chunkSize?: number;
    overlap?: number;
  };
  chunks?: Array<{ content?: string }>;
};

function validDocument(value: IngestRequest["document"]) {
  if (!value) return false;
  return (
    typeof value.title === "string" && value.title.trim().length >= 1 && value.title.length <= 300 &&
    typeof value.fileName === "string" && value.fileName.length >= 1 && value.fileName.length <= 255 &&
    ["application/pdf", "text/plain", "text/markdown"].includes(value.mimeType ?? "") &&
    Number.isInteger(value.pageCount) && Number(value.pageCount) >= 1 && Number(value.pageCount) <= 5000 &&
    ["paragraph", "sentence", "fixed"].includes(value.chunkingStrategy ?? "") &&
    Number.isInteger(value.chunkSize) && Number(value.chunkSize) >= 60 && Number(value.chunkSize) <= 240 &&
    Number.isInteger(value.overlap) && Number(value.overlap) >= 0 && Number(value.overlap) <= 60 &&
    Number(value.overlap) < Number(value.chunkSize)
  );
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(request) });
  }
  if (request.method !== "POST") return jsonResponse(request, { error: "Method not allowed." }, 405);

  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) {
    return jsonResponse(request, { error: "Authentication is required." }, 401);
  }

  let body: IngestRequest;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(request, { error: "Request body must be valid JSON." }, 400);
  }
  if (!validDocument(body.document)) {
    return jsonResponse(request, { error: "Document metadata is invalid." }, 400);
  }
  const chunks = body.chunks ?? [];
  if (
    chunks.length < 1 ||
    chunks.length > 200 ||
    chunks.some(({ content }) => !content || content.length > 12000)
  ) {
    return jsonResponse(request, { error: "Document chunks are invalid." }, 400);
  }

  const client = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: authorization } } },
  );
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData.user) {
    return jsonResponse(request, { error: "Authentication is required." }, 401);
  }

  const metadata = body.document!;
  const { data: document, error: documentError } = await client
    .from("documents")
    .insert({
      user_id: userData.user.id,
      title: metadata.title!.trim(),
      file_name: metadata.fileName,
      mime_type: metadata.mimeType,
      page_count: metadata.pageCount,
      chunking_strategy: metadata.chunkingStrategy,
      chunk_size: metadata.chunkSize,
      overlap: metadata.overlap,
      chunk_count: chunks.length,
      status: "processing",
    })
    .select("id")
    .single();
  if (documentError || !document) {
    return jsonResponse(request, { error: "The document record could not be created." }, 502);
  }

  try {
    const model = new Supabase.ai.Session("gte-small");
    const rows = [];
    for (let start = 0; start < chunks.length; start += 4) {
      const batch = chunks.slice(start, start + 4);
      const embeddings = await Promise.all(
        batch.map(({ content }) =>
          model.run(content!, { mean_pool: true, normalize: true }),
        ),
      );
      rows.push(
        ...batch.map(({ content }, index) => ({
          document_id: document.id,
          user_id: userData.user.id,
          chunk_index: start + index,
          content,
          token_estimate: Math.max(1, Math.ceil(content!.length / 4)),
          embedding: embeddings[index],
        })),
      );
    }

    const { error: chunksError } = await client.from("document_chunks").insert(rows);
    if (chunksError) throw chunksError;
    const { error: readyError } = await client
      .from("documents")
      .update({ status: "ready", updated_at: new Date().toISOString() })
      .eq("id", document.id);
    if (readyError) throw readyError;

    return jsonResponse(request, {
      documentId: document.id,
      chunkCount: chunks.length,
      embeddingModel: "gte-small",
      dimensions: 384,
    }, 201);
  } catch {
    await client.from("documents").delete().eq("id", document.id);
    return jsonResponse(request, { error: "Embedding or storage failed; no partial document was kept." }, 502);
  }
});

