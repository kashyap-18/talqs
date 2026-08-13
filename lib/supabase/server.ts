import { createClient } from "@supabase/supabase-js";
import {
  isSupabaseConfigured,
  supabasePublishableKey,
  supabaseUrl,
} from "./config";

export function bearerToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  return authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
}

export function getAuthenticatedServerClient(request: Request) {
  if (!isSupabaseConfigured()) return null;
  const token = bearerToken(request);
  if (!token) return null;

  return createClient(supabaseUrl, supabasePublishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

export function getSupabaseServiceClient() {
  const secretKey = process.env.SUPABASE_SECRET_KEY ?? "";
  if (!isSupabaseConfigured() || !secretKey) return null;
  return createClient(supabaseUrl, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
