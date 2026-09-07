import { createClient } from "@supabase/supabase-js";

// Fallback placeholders keep createClient from throwing at startup when the
// env vars are missing (e.g. no .env file); auth then falls back to demo mode.
// Safe environment variable access across client Vite and server/SSR
const env =
  typeof import.meta !== "undefined" && import.meta.env
    ? import.meta.env
    : typeof process !== "undefined" && process.env
      ? (process.env as Record<string, string | undefined>)
      : {};

const supabaseUrl =
  (env["VITE_SUPABASE_URL"] as string | undefined) || "https://placeholder.supabase.co";
const supabaseAnonKey =
  (env["VITE_SUPABASE_ANON_KEY"] as string | undefined) || "placeholder-anon-key";

export const isSupabaseConfigured =
  supabaseUrl !== "https://placeholder.supabase.co" && supabaseAnonKey !== "placeholder-anon-key";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
