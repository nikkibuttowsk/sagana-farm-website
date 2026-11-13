import assert from "node:assert/strict";
import test from "node:test";
import { postReservationAction } from "../../src/lib/reservations/http.mjs";

const appBaseUrl = "https://sagana.example";

function formRequest(entries, method = "POST") {
  return new Request(`${appBaseUrl}/api/reservation-action`, {
    method,
    headers: {
      origin: appBaseUrl,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: method === "POST" ? new URLSearchParams(entries) : undefined,
  });
}

test("neverMutatesOnGet", async () => {
  let called = false;
  const response = await postReservationAction(formRequest({}, "GET"), {
    appBaseUrl,
    async handleReservationDecision() {
      called = true;
    },
  });

  assert.equal(response.status, 405);
  assert.equal(called, false);
});

test("rejectsInvalidDecisionAndDoesNotExposeSubmittedToken", async () => {
  const secretToken = "private-action-token";
  let called = false;
  const response = await postReservationAction(
    formRequest({ token: secretToken, decision: "maybe" }),
    {
      appBaseUrl,
      async handleReservationDecision() {
        called = true;
      },
    },
  );

  assert.equal(response.status, 303);
  assert.equal(called, false);
  assert.doesNotMatch(response.headers.get("location"), /private-action-token/);
});

test("redirectsWithExplicitDecisionAndMailOutcome", async () => {
  let received;
  const response = await postReservationAction(
    formRequest({ token: "A".repeat(43), decision: "approve" }),
    {
      appBaseUrl,
      async handleReservationDecision(input) {
        received = input;
        return { status: "approved", visitorEmailSent: false };
      },
    },
  );

  assert.deepEqual(received, {
    token: "A".repeat(43),
    decision: "approve",
  });
  assert.equal(response.status, 303);
  assert.match(response.headers.get("location"), /status=approved/);
  assert.match(response.headers.get("location"), /email=failed/);
  assert.doesNotMatch(response.headers.get("location"), /A{43}/);
});
