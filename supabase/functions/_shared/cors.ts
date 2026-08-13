const productionOrigins = new Set([
  "https://talqs.talqs-prototype.workers.dev",
  "https://talqs-consumer-demo.kashyapauppuluri.chatgpt.site",
]);

function allowedOrigin(origin: string) {
  if (productionOrigins.has(origin)) return origin;
  if (/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) return origin;
  const configured = (Deno.env.get("TALQS_ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return configured.includes(origin) ? origin : "";
}

export function corsHeaders(request: Request) {
  const origin = allowedOrigin(request.headers.get("origin") ?? "");
  return {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Origin": origin || "null",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export function jsonResponse(request: Request, body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      ...corsHeaders(request),
      "Cache-Control": "no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

