import assert from "node:assert/strict";
import test from "node:test";
import {
  getTrustedClientIp,
  hashRateLimitIdentifier,
} from "../../src/lib/reservations/rate-limit.mjs";

test("acceptsOnlyOneValidatedForwardedClientAddress", () => {
  const request = new Request("https://sagana.example/api/reservations", {
    headers: { "x-forwarded-for": "203.0.113.8" },
  });

  assert.equal(getTrustedClientIp(request), "203.0.113.8");
  assert.throws(
    () =>
      getTrustedClientIp(
        new Request("https://sagana.example/api/reservations"),
      ),
    { name: "ServerConfigurationError" },
  );
  assert.throws(
    () =>
      getTrustedClientIp(
        new Request("https://sagana.example/api/reservations", {
          headers: { "x-forwarded-for": "203.0.113.8, 10.0.0.1" },
        }),
      ),
    { name: "ServerConfigurationError" },
  );
});

test("hashesRateLimitIdentifiersWithScopedKeyedDigests", () => {
  const secret = "s".repeat(32);
  const ipHash = hashRateLimitIdentifier("ip", "203.0.113.8", secret);
  const emailHash = hashRateLimitIdentifier(
    "email",
    "maria@example.com",
    secret,
  );

  assert.match(ipHash, /^[0-9a-f]{64}$/);
  assert.notEqual(ipHash, "203.0.113.8");
  assert.equal(
    ipHash,
    hashRateLimitIdentifier("ip", "203.0.113.8", secret),
  );
  assert.notEqual(
    ipHash,
    hashRateLimitIdentifier("email", "203.0.113.8", secret),
  );
  assert.throws(
    () => hashRateLimitIdentifier("ip", "203.0.113.8", "short"),
    { name: "ServerConfigurationError" },
  );
});
