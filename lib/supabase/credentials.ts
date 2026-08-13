import { getSupabaseBrowserClient } from "./client";

export type Provider = "openai" | "groq" | "openrouter" | "gemini" | "anthropic";

export type SavedCredential = {
  id: string;
  provider: Provider;
  model: string;
  key_hint: string;
  created_at: string;
  updated_at: string;
  last_used_at: string | null;
};

async function authenticatedFetch(path: string, init?: RequestInit) {
  const client = getSupabaseBrowserClient();
  const { data } = (await client?.auth.getSession()) ?? { data: { session: null } };
  if (!data.session) throw new Error("Sign in to use the credential vault.");
  return fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${data.session.access_token}`,
      ...init?.headers,
    },
  });
}

export async function loadCredentials() {
  const response = await authenticatedFetch("/api/credentials");
  const payload = (await response.json()) as { credentials?: SavedCredential[]; error?: string };
  if (!response.ok) throw new Error(payload.error ?? "Credentials could not be loaded.");
  return payload.credentials ?? [];
}

export async function saveCredential(provider: Provider, model: string, apiKey: string) {
  const response = await authenticatedFetch("/api/credentials", {
    method: "POST",
    body: JSON.stringify({ provider, model, apiKey }),
  });
  const payload = (await response.json()) as { credential?: SavedCredential; error?: string };
  if (!response.ok || !payload.credential) {
    throw new Error(payload.error ?? "Credential could not be saved.");
  }
  return payload.credential;
}

export async function removeCredential(id: string) {
  const response = await authenticatedFetch(`/api/credentials?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  const payload = (await response.json()) as { error?: string };
  if (!response.ok) throw new Error(payload.error ?? "Credential could not be deleted.");
}

export async function modelAuthorizationHeader() {
  const client = getSupabaseBrowserClient();
  const { data } = (await client?.auth.getSession()) ?? { data: { session: null } };
  return data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {};
}

