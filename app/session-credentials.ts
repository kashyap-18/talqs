"use client";

import type { Provider } from "@/lib/supabase/credentials";

const storagePrefix = "talqs.byok.";

function storageId(provider: Provider, model: string) {
  return `${storagePrefix}${provider}:${model.trim()}`;
}

function isBrowser() {
  return typeof window !== "undefined";
}

export function loadSessionApiKey(provider: Provider, model: string) {
  if (!isBrowser() || !model.trim()) return "";
  return window.sessionStorage.getItem(storageId(provider, model)) ?? "";
}

export function saveSessionApiKey(provider: Provider, model: string, apiKey: string) {
  if (!isBrowser() || !model.trim() || !apiKey.trim()) return;
  window.sessionStorage.setItem(storageId(provider, model), apiKey.trim());
}

export function clearSessionApiKey(provider: Provider, model: string) {
  if (!isBrowser() || !model.trim()) return;
  window.sessionStorage.removeItem(storageId(provider, model));
}
