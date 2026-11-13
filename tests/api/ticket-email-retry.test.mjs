import assert from "node:assert/strict";
import test from "node:test";
import { postTicketEmailRetry } from "../../src/lib/reservations/http.mjs";

const appBaseUrl = "https://sagana.example";

function formRequest(entries, origin = appBaseUrl) {
  return new Request(`${appBaseUrl}/api/ticket-email-retry`, {
    method: "POST",
    headers: {
      origin,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(entries),
  });
}

test("redirectsPendingOrInvalidRetryToUnavailableState", async () => {
  let received;
  const response = await postTicketEmailRetry(
    formRequest({ token: "B".repeat(43) }),
    {
      appBaseUrl,
      async retryVisitorTicketEmail(input) {
        received = input;
        return false;
      },
    },
  );

  assert.deepEqual(received, { token: "B".repeat(43) });
  assert.equal(response.status, 303);
  assert.match(response.headers.get("location"), /status=unavailable/);
  assert.doesNotMatch(response.headers.get("location"), /B{43}/);
});

test("rejectsCrossOriginRetry", async () => {
  let called = false;
  const response = await postTicketEmailRetry(
    formRequest({ token: "B".repeat(43) }, "https://attacker.example"),
    {
      appBaseUrl,
      async retryVisitorTicketEmail() {
        called = true;
      },
    },
  );

  assert.equal(response.status, 403);
  assert.equal(called, false);
});
