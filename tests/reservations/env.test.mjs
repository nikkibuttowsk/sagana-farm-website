import assert from "node:assert/strict";
import test from "node:test";
import { requireServerEnv } from "../../src/lib/config/env.mjs";

test("reportsMissingServerEnvironmentValuesWithoutLeakingConfiguredSecrets", () => {
  assert.throws(
    () =>
      requireServerEnv(
        ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"],
        {
          NEXT_PUBLIC_SUPABASE_URL: "",
          SUPABASE_SERVICE_ROLE_KEY: "never-include-this-value",
        },
      ),
    (error) => {
      assert.equal(error.name, "ServerConfigurationError");
      assert.match(error.message, /NEXT_PUBLIC_SUPABASE_URL/);
      assert.doesNotMatch(error.message, /never-include-this-value/);
      return true;
    },
  );
});

test("returnsRequiredEnvironmentValues", () => {
  assert.deepEqual(
    requireServerEnv(["APP_BASE_URL"], { APP_BASE_URL: "https://farm.example" }),
    { APP_BASE_URL: "https://farm.example" },
  );
});
