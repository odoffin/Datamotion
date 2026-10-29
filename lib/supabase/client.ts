import { createBrowserClient } from "@supabase/ssr";
import { supabaseEnv } from "./env";

// TODO: pass generated Database types once they're generated from the live schema.
export function createClient() {
  const { url, key } = supabaseEnv();
  return createBrowserClient(url, key);
}
