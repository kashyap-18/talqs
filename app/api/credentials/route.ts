import { encryptCredential } from "@/lib/security/credential-crypto";
import {
  bearerToken,
  getAuthenticatedServerClient,
  getSupabaseServiceClient,
} from "@/lib/supabase/server";

type Provider = "openai" | "groq" | "openrouter" | "gemini" | "anthropic";

const headers = {
  "Cache-Control": "no-store, max-age=0",
  "Content-Type": "application/json; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers });
}

function validProvider(value: unknown): value is Provider {
  return ["openai", "groq", "openrouter", "gemini", "anthropic"].includes(String(value));
}

async function authenticated(request: Request) {
  const client = getAuthenticatedServerClient(request);
  const token = bearerToken(request);
  if (!client || !token) return null;
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  const service = getSupabaseServiceClient();
  if (!service) return { client, user: data.user, service: null };
  return { client, user: data.user, service };
}

export async function GET(request: Request) {
  const auth = await authenticated(request);
  if (!auth) return json({ error: "Authentication is required." }, 401);
  if (!auth.service) return json({ error: "The server data connection is not configured." }, 503);

  const { data, error } = await auth.service
    .from("provider_credentials")
    .select("id, provider, model, key_hint, created_at, updated_at, last_used_at")
    .eq("user_id", auth.user.id)
    .order("updated_at", { ascending: false });

  if (error) return json({ error: "Saved credentials could not be loaded." }, 502);
  return json({ credentials: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await authenticated(request);
  if (!auth) return json({ error: "Authentication is required." }, 401);
  if (!auth.service) return json({ error: "The server data connection is not configured." }, 503);

  let body: { provider?: Provider; model?: string; apiKey?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: "Request body must be valid JSON." }, 400);
  }

  const provider = body.provider;
  const model = body.model?.trim() ?? "";
  const apiKey = body.apiKey?.trim() ?? "";
  if (!validProvider(provider)) return json({ error: "Provider is not allowed." }, 400);
  if (!/^[A-Za-z0-9._:/-]{2,100}$/.test(model)) {
    return json({ error: "Model id is invalid." }, 400);
  }
  if (apiKey.length < 20 || apiKey.length > 500 || /\s/.test(apiKey)) {
    return json({ error: "API key format is invalid." }, 400);
  }

  try {
    const encrypted = await encryptCredential(apiKey);
    const timestamp = new Date().toISOString();
    const { data, error } = await auth.service
      .from("provider_credentials")
      .upsert(
        {
          user_id: auth.user.id,
          provider,
          model,
          encrypted_key: encrypted.encryptedKey,
          key_iv: encrypted.keyIv,
          key_hint: apiKey.slice(-4),
          updated_at: timestamp,
        },
        { onConflict: "user_id,provider,model" },
      )
      .select("id, provider, model, key_hint, created_at, updated_at, last_used_at")
      .single();

    if (error || !data) return json({ error: "The credential could not be saved." }, 502);
    return json({ credential: data }, 201);
  } catch (error) {
    return json(
      {
        error:
          error instanceof Error && error.message.includes("TALQS_KEY_ENCRYPTION_SECRET")
            ? "The server credential vault is not configured."
            : "The credential could not be encrypted.",
      },
      503,
    );
  }
}

export async function DELETE(request: Request) {
  const auth = await authenticated(request);
  if (!auth) return json({ error: "Authentication is required." }, 401);
  if (!auth.service) return json({ error: "The server data connection is not configured." }, 503);
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "Credential id is invalid." }, 400);

  const { error } = await auth.service
    .from("provider_credentials")
    .delete()
    .eq("id", id)
    .eq("user_id", auth.user.id);
  if (error) return json({ error: "The credential could not be deleted." }, 502);
  return json({ deleted: true });
}
