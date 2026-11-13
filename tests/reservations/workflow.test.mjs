import assert from "node:assert/strict";
import test from "node:test";
import {
  handleReservationDecision,
  retryVisitorTicketEmail,
  submitReservation,
} from "../../src/lib/reservations/workflow.mjs";

const reservation = {
  id: "reservation-123",
  status: "pending",
  visitor_email: "maria@example.com",
  farm_name: "Sagana Farm",
  visit_date: "2099-01-01",
  time_slot_label: "Morning",
  guest_count: 2,
};

function createDeps(overrides = {}) {
  const calls = [];
  const tokens = [
    { token: "admin-action-token", hash: "a".repeat(64) },
    { token: "retry-email-token", hash: "b".repeat(64) },
    { token: "ticket-token", hash: "c".repeat(64) },
    { token: "replacement-ticket-token", hash: "d".repeat(64) },
  ];
  const deps = {
    calls,
    repository: {
      async createPendingReservation(input, actionHash, retryHash) {
        calls.push(["createPendingReservation", input, actionHash, retryHash]);
        return reservation;
      },
      async decideReservation(token, decision, ticketHash) {
        calls.push(["decideReservation", token, decision, ticketHash]);
        return {
          ok: true,
          reservation: { ...reservation, status: decision === "approve" ? "approved" : "rejected" },
        };
      },
      async claimTicketEmailRetry(token, replacementHash) {
        calls.push(["claimTicketEmailRetry", token, replacementHash]);
        return { ...reservation, status: "approved" };
      },
    },
    email: {
      async sendAdminReservationEmail(value, urls) {
        calls.push(["sendAdminReservationEmail", value, urls]);
      },
      async sendVisitorStatusEmail(value, status, ticket) {
        calls.push(["sendVisitorStatusEmail", value, status, ticket]);
      },
    },
    createOpaqueToken() {
      return tokens.shift();
    },
    async createTicketQrDataUrl(url) {
      calls.push(["createTicketQrDataUrl", url]);
      return "data:image/png;base64,qr";
    },
    appBaseUrl: "https://sagana.example",
  };

  return { ...deps, ...overrides };
}

test("savesPendingRequestBeforeNotifyingAdmin", async () => {
  const deps = createDeps();
  const input = { farmId: "farm-id", visitorName: "Maria Santos" };

  const result = await submitReservation(input, deps);

  assert.deepEqual(result, { reference: reservation.id, notificationSent: true });
  assert.deepEqual(
    deps.calls.map(([name]) => name),
    ["createPendingReservation", "sendAdminReservationEmail"],
  );
  assert.equal(deps.calls[0][1], input);
  assert.equal(deps.calls[0][2], "a".repeat(64));
  assert.equal(deps.calls[0][3], "b".repeat(64));
  assert.match(deps.calls[1][2].actionUrl, /admin-action-token/);
  assert.match(deps.calls[1][2].retryUrl, /retry-email-token/);
});

test("surfacesAdminEmailFailureWithSavedReference", async () => {
  const deps = createDeps({
    logger: { error() {} },
    email: {
      async sendAdminReservationEmail() {
        throw new Error("mail service unavailable");
      },
    },
  });

  const result = await submitReservation({ visitorName: "Maria" }, deps);

  assert.deepEqual(result, {
    reference: reservation.id,
    notificationSent: false,
  });
  assert.equal(deps.calls[0][0], "createPendingReservation");
});

test("logsAdminEmailProviderCodeWithoutLoggingProviderMessage", async () => {
  const logged = [];
  const error = Object.assign(new Error("private provider details"), {
    code: "BREVO_401",
  });
  const deps = createDeps({
    logger: { error(...args) { logged.push(args); } },
    email: {
      async sendAdminReservationEmail() {
        throw error;
      },
    },
  });

  await submitReservation({ visitorName: "Maria" }, deps);

  assert.deepEqual(logged, [
    [
      "Could not send admin reservation email.",
      { name: "Error", code: "BREVO_401" },
    ],
  ]);
  assert.doesNotMatch(JSON.stringify(logged), /private provider details/);
});

test("approvesOnceThenSendsTicket", async () => {
  const deps = createDeps({
    createOpaqueToken: () => ({ token: "ticket-token", hash: "c".repeat(64) }),
  });

  const result = await handleReservationDecision(
    { token: "admin-action-token", decision: "approve" },
    deps,
  );

  assert.deepEqual(result, { status: "approved", visitorEmailSent: true });
  assert.deepEqual(
    deps.calls.map(([name]) => name),
    [
      "decideReservation",
      "createTicketQrDataUrl",
      "sendVisitorStatusEmail",
    ],
  );
  assert.equal(deps.calls[0][2], "approve");
  assert.equal(deps.calls[0][3], "c".repeat(64));
  assert.equal(
    deps.calls[1][1],
    "https://sagana.example/ticket/ticket-token",
  );
});

test("rejectsOnceThenSendsVisitorStatus", async () => {
  const deps = createDeps();

  const result = await handleReservationDecision(
    { token: "admin-action-token", decision: "reject" },
    deps,
  );

  assert.deepEqual(result, { status: "rejected", visitorEmailSent: true });
  assert.equal(deps.calls[0][2], "reject");
  assert.equal(deps.calls[0][3], undefined);
  assert.deepEqual(deps.calls[1].slice(0, 3), [
    "sendVisitorStatusEmail",
    { ...reservation, status: "rejected" },
    "rejected",
  ]);
});

test("preservesApprovalWhenVisitorEmailFails", async () => {
  const deps = createDeps({
    logger: { error() {} },
    email: {
      async sendVisitorStatusEmail() {
        throw new Error("mail service unavailable");
      },
    },
  });

  const result = await handleReservationDecision(
    { token: "admin-action-token", decision: "approve" },
    deps,
  );

  assert.deepEqual(result, { status: "approved", visitorEmailSent: false });
  assert.equal(deps.calls[0][0], "decideReservation");
  assert.equal(deps.calls[0][2], "approve");
});

test("preservesApprovalWhenTicketQrGenerationFails", async () => {
  const deps = createDeps({
    logger: { error() {} },
    createOpaqueToken: () => ({ token: "ticket-token", hash: "c".repeat(64) }),
    async createTicketQrDataUrl() {
      throw new Error("QR encoder unavailable");
    },
  });

  const result = await handleReservationDecision(
    { token: "admin-action-token", decision: "approve" },
    deps,
  );

  assert.deepEqual(result, { status: "approved", visitorEmailSent: false });
  assert.equal(deps.calls[0][2], "approve");
  assert.equal(
    deps.calls.some(([name]) => name === "sendVisitorStatusEmail"),
    false,
  );
});

test("retriesTicketWithoutChangingApproval", async () => {
  const deps = createDeps({
    createOpaqueToken: () => ({
      token: "replacement-ticket-token",
      hash: "d".repeat(64),
    }),
  });

  await retryVisitorTicketEmail({ token: "retry-email-token" }, deps);

  assert.deepEqual(
    deps.calls.map(([name]) => name),
    [
      "claimTicketEmailRetry",
      "createTicketQrDataUrl",
      "sendVisitorStatusEmail",
    ],
  );
  assert.equal(deps.calls[0][2], "d".repeat(64));
  assert.equal(deps.calls[2][2], "approved");
});
