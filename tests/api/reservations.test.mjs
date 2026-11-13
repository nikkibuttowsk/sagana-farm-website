import assert from "node:assert/strict";
import test from "node:test";
import { ServerConfigurationError } from "../../src/lib/config/env.mjs";
import { postReservation } from "../../src/lib/reservations/http.mjs";

const appBaseUrl = "https://sagana.example";
const validInput = {
  visitorName: "Maria Santos",
  visitorEmail: "maria@example.com",
  visitorPhone: "+639171234567",
  farmId: "9d08750e-f7cb-4951-9c68-4f5b88af2e39",
  timeSlotId: "3e42d646-b6d1-4667-80e4-2265568fd4aa",
  guestCount: 2,
  visitDate: "2099-01-01",
};

function request(body, { origin = appBaseUrl, contentType = "application/json" } = {}) {
  return new Request(`${appBaseUrl}/api/reservations`, {
    method: "POST",
    headers: {
      origin,
      "content-type": contentType,
    },
    body,
  });
}

function dependencies(overrides = {}) {
  return {
    appBaseUrl,
    async claimReservationRateLimit() {
      return { allowed: true };
    },
    async submitReservation() {
      return { reference: "reservation-reference", notificationSent: true };
    },
    ...overrides,
  };
}

test("rejectsMalformedJsonBeforeCallingWorkflow", async () => {
  let called = false;
  const response = await postReservation(
    request("{"),
    dependencies({
      async submitReservation() {
        called = true;
      },
    }),
  );

  assert.equal(response.status, 400);
  assert.equal(called, false);
});

test("rejectsCrossOriginHoneypotAndOversizedRequests", async () => {
  const deps = dependencies();

  assert.equal(
    (await postReservation(request(JSON.stringify(validInput), { origin: "https://attacker.example" }), deps)).status,
    403,
  );
  assert.equal(
    (await postReservation(request(JSON.stringify({ ...validInput, website: "spam" })), deps)).status,
    400,
  );
  assert.equal(
    (await postReservation(request("x".repeat(32 * 1024 + 1)), deps)).status,
    413,
  );
});

test("validatesFieldsBeforePersistence", async () => {
  let called = false;
  const response = await postReservation(
    request(JSON.stringify({ ...validInput, visitorEmail: "invalid" })),
    dependencies({
      async submitReservation() {
        called = true;
      },
    }),
  );

  assert.equal(response.status, 422);
  assert.equal(called, false);
  assert.ok((await response.json()).errors.visitorEmail);
});

test("returnsCreatedReferenceWithoutContactOrTokenData", async () => {
  const response = await postReservation(
    request(JSON.stringify(validInput)),
    dependencies(),
  );

  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), {
    saved: true,
    reference: "reservation-reference",
    notificationSent: true,
  });
});

test("reportsPersistedReservationWhenAdminEmailFails", async () => {
  const response = await postReservation(
    request(JSON.stringify(validInput)),
    dependencies({
      logger: { error() {} },
      async submitReservation() {
        return {
          reference: "reservation-reference",
          notificationSent: false,
        };
      },
    }),
  );

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    saved: true,
    reference: "reservation-reference",
    notificationSent: false,
  });
});

test("throttlesBeforeCreatingReservationAndReturnsRetryDelay", async () => {
  let persisted = false;
  const response = await postReservation(
    request(JSON.stringify(validInput)),
    dependencies({
      async claimReservationRateLimit() {
        return { allowed: false, retryAfterSeconds: 86400 };
      },
      async submitReservation() {
        persisted = true;
      },
    }),
  );

  assert.equal(response.status, 429);
  assert.equal(response.headers.get("retry-after"), "86400");
  assert.equal(persisted, false);
  assert.deepEqual(await response.json(), {
    error: "Too many reservation requests. Please try again later.",
  });
});

test("reportsMissingServerConfigurationWithoutLeakingEnvironmentDetails", async () => {
  const response = await postReservation(
    request(JSON.stringify(validInput)),
    dependencies({
      logger: { error() {} },
      async submitReservation() {
        throw new ServerConfigurationError(
          "Missing required environment variables: SUPABASE_SERVICE_ROLE_KEY",
        );
      },
    }),
  );

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    error: "Reservation service is not configured.",
  });
});

test("logsSupabaseErrorCodesWithoutLoggingErrorMessages", async () => {
  const logged = [];
  const error = Object.assign(new Error("private request details"), {
    code: "PGRST202",
  });
  const response = await postReservation(
    request(JSON.stringify(validInput)),
    dependencies({
      logger: { error(...args) { logged.push(args); } },
      async claimReservationRateLimit() {
        throw error;
      },
    }),
  );

  assert.equal(response.status, 500);
  assert.deepEqual(logged, [
    [
      "Could not save farm reservation.",
      { name: "Error", code: "PGRST202" },
    ],
  ]);
  assert.doesNotMatch(JSON.stringify(logged), /private request details/);
});
