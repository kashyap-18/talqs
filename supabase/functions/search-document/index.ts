import { createClient } from "npm:@supabase/supabase-js@2.112.3";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

type SearchRequest = {
  documentId?: string;
  query?: string;
  threshold?: number;
  topK?: number;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(request) });
  }
  if (request.method !== "POST") return jsonResponse(request, { error: "Method not allowed." }, 405);

  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) {
    return jsonResponse(request, { error: "Authentication is required." }, 401);
  }

  let body: SearchRequest;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(request, { error: "Request body must be valid JSON." }, 400);
  }
  const query = body.query?.trim() ?? "";
  const threshold = body.threshold ?? 0.55;
  const topK = body.topK ?? 5;
  if (!/^[0-9a-f-]{36}$/i.test(body.documentId ?? "")) {
    return jsonResponse(request, { error: "Document id is invalid." }, 400);
  }
  if (query.length < 3 || query.length > 500) {
    return jsonResponse(request, { error: "Query length is invalid." }, 400);
  }
  if (threshold < 0 || threshold > 1 || !Number.isInteger(topK) || topK < 1 || topK > 20) {
    return jsonResponse(request, { error: "Search options are invalid." }, 400);
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

  const started = performance.now();
  try {
    const model = new Supabase.ai.Session("gte-small");
    const embedding = await model.run(query, { mean_pool: true, normalize: true });
    const embeddingMs = performance.now() - started;
    const retrievalStarted = performance.now();
    const { data, error } = await client.rpc("match_document_chunks", {
      p_document_id: body.documentId,
      p_query_embedding: embedding,
      p_match_threshold: threshold,
      p_match_count: topK,
    });
    if (error) throw error;

    return jsonResponse(request, {
      hits: data ?? [],
      embeddingModel: "gte-small",
      dimensions: 384,
      threshold,
      topK,
      timings: {
        embeddingMs: Math.round(embeddingMs * 10) / 10,
        retrievalMs: Math.round((performance.now() - retrievalStarted) * 10) / 10,
        totalMs: Math.round((performance.now() - started) * 10) / 10,
      },
      fallback: !data?.length,
    });
  } catch {
    return jsonResponse(request, { error: "Semantic retrieval failed." }, 502);
  }
});

