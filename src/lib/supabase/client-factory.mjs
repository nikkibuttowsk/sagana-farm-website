import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";

const SERVER_AUTH_OPTIONS = {
  auth: {
    autoRefreshToken: false,
    detectSessionInUrl: false,
    persistSession: false,
  },
  realtime: {
    transport: WebSocket,
  },
};

export function createSupabaseServerClient(url, key) {
  return createClient(url, key, SERVER_AUTH_OPTIONS);
}
