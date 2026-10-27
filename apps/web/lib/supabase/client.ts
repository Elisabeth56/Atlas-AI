// Browser-side Supabase client. Null when the app runs without sign-in (local development with AUTH_MODE=off).
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let client: SupabaseClient | null = null;

export function supabaseBrowser(): SupabaseClient | null {
  if (!url || !anonKey) return null;
  client ??= createBrowserClient(url, anonKey);
  return client;
}

/** The current access token, for the Authorization header on API calls. */
export async function accessToken(): Promise<string | null> {
  const supabase = supabaseBrowser();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}
