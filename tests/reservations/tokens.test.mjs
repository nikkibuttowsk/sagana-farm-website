import assert from "node:assert/strict";
import test from "node:test";
import { createOpaqueToken, hashToken } from "../../src/lib/reservations/tokens.mjs";

test("createsUniqueOpaqueTokenAndHash", () => {
  const first = createOpaqueToken();
  const second = createOpaqueToken();

  assert.notEqual(first.token, second.token);
  assert.equal(first.hash, hashToken(first.token));
  assert.match(first.hash, /^[0-9a-f]{64}$/);
});

test("hashesSameTokenDeterministically", () => {
  assert.equal(
    hashToken("ticket-secret"),
    "8954da8c03d3ceeb3f0e56cb86e9d3c003baa2338d58ba4c43a0f741c1e8ea3b",
  );
});

test("rejectsEmptyToken", () => {
  assert.throws(() => hashToken(""), /token/i);
  assert.throws(() => hashToken(null), /token/i);
});
