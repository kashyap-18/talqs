import { decryptCredential } from "@/lib/security/credential-crypto";
import {
  bearerToken,
  getAuthenticatedServerClient,
  getSupabaseServiceClient,
} from "@/lib/supabase/server";

type Provider = "openai" | "groq" | "openrouter" | "gemini" | "anthropic";

type ModelRequest = {
  provider?: Provider;
  model?: string;
  apiKey?: string;
  credentialId?: string;
  prompt?: string;
};

type NormalizedModelResponse = {
  output: string;
  usage: {
    inputTokens: number | null;
    outputTokens: number | null;
    totalTokens: number | null;
  };
};

const openAiCompatibleEndpoints = {
  openai: "https://api.openai.com/v1/chat/completions",
  groq: "https://api.groq.com/openai/v1/chat/completions",
  openrouter: "https://openrouter.ai/api/v1/chat/completions",
} as const;

const responseHeaders = {
  "Cache-Control": "no-store, max-age=0",
  "Content-Type": "application/json; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: responseHeaders });
}

function validProvider(value: unknown): value is Provider {
  return ["openai", "groq", "openrouter", "gemini", "anthropic"].includes(
    String(value),
  );
}

function isOpenAiCompatible(
  provider: Provider,
): provider is keyof typeof openAiCompatibleEndpoints {
  return provider in openAiCompatibleEndpoints;
}

function buildProviderRequest(
  provider: Provider,
  model: string,
  apiKey: string,
  prompt: string,
) {
  if (isOpenAiCompatible(provider)) {
    return {
      url: openAiCompatibleEndpoints[provider],
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: {
        model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 500,
      },
    };
  }

  if (provider === "anthropic") {
    return {
      url: "https://api.anthropic.com/v1/messages",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: {
        model,
        max_tokens: 500,
        messages: [{ role: "user", content: prompt }],
      },
    };
  }

  const geminiModel = model.replace(/^models\//, "");
  return {
    url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(geminiModel)}:generateContent`,
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 500 },
    },
  };
}

function normalizeResponse(provider: Provider, payload: unknown): NormalizedModelResponse | null {
  if (!payload || typeof payload !== "object") return null;

  if (isOpenAiCompatible(provider)) {
    const value = payload as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    };
    const output = value.choices?.[0]?.message?.content?.trim();
    if (!output) return null;
    return {
      output,
      usage: {
        inputTokens: value.usage?.prompt_tokens ?? null,
        outputTokens: value.usage?.completion_tokens ?? null,
        totalTokens: value.usage?.total_tokens ?? null,
      },
    };
  }

  if (provider === "anthropic") {
    const value = payload as {
      content?: Array<{ type?: string; text?: string }>;
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    const output = value.content
      ?.filter((block) => block.type === "text" && block.text)
      .map((block) => block.text)
      .join("\n")
      .trim();
    if (!output) return null;
    const inputTokens = value.usage?.input_tokens ?? null;
    const outputTokens = value.usage?.output_tokens ?? null;
    return {
      output,
      usage: {
        inputTokens,
        outputTokens,
        totalTokens:
          inputTokens !== null && outputTokens !== null ? inputTokens + outputTokens : null,
      },
    };
  }

  const value = payload as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    usageMetadata?: {
      promptTokenCount?: number;
      candidatesTokenCount?: number;
      totalTokenCount?: number;
    };
  };
  const output = value.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("")
    .trim();
  if (!output) return null;
  return {
    output,
    usage: {
      inputTokens: value.usageMetadata?.promptTokenCount ?? null,
      outputTokens: value.usageMetadata?.candidatesTokenCount ?? null,
      totalTokens: value.usageMetadata?.totalTokenCount ?? null,
    },
  };
}

export async function POST(request: Request) {
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > 64_000) return json({ error: "Request is too large." }, 413);

  let body: ModelRequest;
  try {
    body = (await request.json()) as ModelRequest;
  } catch {
    return json({ error: "Request body must be valid JSON." }, 400);
  }

  const { provider, model, credentialId, prompt } = body;
  let apiKey = body.apiKey?.trim() ?? "";
  let credentialUserId = "";
  if (!validProvider(provider)) return json({ error: "Provider is not allowed." }, 400);
  if (!model || !/^[A-Za-z0-9._:/-]{2,100}$/.test(model)) {
    return json({ error: "Model id is invalid." }, 400);
  }
  if (credentialId) {
    const client = getAuthenticatedServerClient(request);
    const token = bearerToken(request);
    if (!client || !token) return json({ error: "Authentication is required." }, 401);
    const { data: userData, error: userError } = await client.auth.getUser(token);
    if (userError || !userData.user) return json({ error: "Authentication is required." }, 401);
    credentialUserId = userData.user.id;
    const service = getSupabaseServiceClient();
    if (!service) return json({ error: "The server data connection is not configured." }, 503);

    const { data: credential, error: credentialError } = await service
      .from("provider_credentials")
      .select("id, provider, model, encrypted_key, key_iv")
      .eq("id", credentialId)
      .eq("provider", provider)
      .eq("model", model)
      .eq("user_id", userData.user.id)
      .single();
    if (credentialError || !credential) {
      return json({ error: "The saved credential was not found." }, 404);
    }
    try {
      apiKey = await decryptCredential(credential.encrypted_key, credential.key_iv);
    } catch {
      return json({ error: "The saved credential could not be decrypted." }, 503);
    }
  }
  if (!apiKey || apiKey.length < 20 || apiKey.length > 500 || /\s/.test(apiKey)) {
    return json({ error: "API key format is invalid." }, 400);
  }
  if (!prompt || prompt.length < 80 || prompt.length > 18_000) {
    return json({ error: "Grounded prompt length is outside the allowed range." }, 400);
  }

  const started = Date.now();
  const providerRequest = buildProviderRequest(provider, model, apiKey, prompt);

  try {
    const upstream = await fetch(providerRequest.url, {
      method: "POST",
      headers: providerRequest.headers,
      body: JSON.stringify(providerRequest.body),
      signal: AbortSignal.timeout(30_000),
    });

    if (!upstream.ok) {
      return json(
        {
          error: "The model provider rejected the request.",
          providerStatus: upstream.status,
          latencyMs: Date.now() - started,
        },
        502,
      );
    }

    const normalized = normalizeResponse(provider, await upstream.json());
    if (!normalized) return json({ error: "The provider returned no text." }, 502);

    if (credentialId) {
      const service = getSupabaseServiceClient();
      await service
        ?.from("provider_credentials")
        .update({ last_used_at: new Date().toISOString() })
        .eq("id", credentialId)
        .eq("user_id", credentialUserId);
    }

    return json({
      ...normalized,
      provider,
      model,
      latencyMs: Date.now() - started,
      keyStored: Boolean(credentialId),
    });
  } catch (error) {
    return json(
      {
        error:
          error instanceof Error && error.name === "TimeoutError"
            ? "The model request timed out."
            : "The model request failed before a response was received.",
        latencyMs: Date.now() - started,
      },
      502,
    );
  }
}
