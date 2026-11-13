import assert from "node:assert/strict";
import test from "node:test";
import { createSupabaseServerClient } from "../../src/lib/supabase/client-factory.mjs";

test("creates Supabase server clients in the supported Node runtime", () => {
  assert.doesNotThrow(() =>
    createSupabaseServerClient("http://127.0.0.1:54321", "test-key"),
  );
});
