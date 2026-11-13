import assert from "node:assert/strict";
import test from "node:test";
import {
  claimTicketEmailRetry,
  claimReservationSubmissionRateLimit,
  createPendingReservation,
  decideReservation,
  getActiveFarms,
  getActiveTimeSlots,
  getApprovedTicket,
} from "../../src/lib/reservations/repository.mjs";
import { hashToken } from "../../src/lib/reservations/tokens.mjs";

const farmId = "9d08750e-f7cb-4951-9c68-4f5b88af2e39";
const timeSlotId = "3e42d646-b6d1-4667-80e4-2265568fd4aa";
const farm = {
  id: farmId,
  name: "Sagana Farm",
  description: "Farm visit",
  location: "Rizal",
  max_party_size: 4,
};
const timeSlot = {
  id: timeSlotId,
  farm_id: farmId,
  label: "Morning",
  sort_order: 0,
};
const validInput = {
  visitorName: "Maria Santos",
  visitorEmail: "maria@example.com",
  visitorPhone: "+639171234567",
  farmId,
  timeSlotId,
  guestCount: 2,
  visitDate: "2099-01-01",
};

function createSupabaseFake(responses) {
  const calls = [];

  function resolve(call) {
    calls.push(call);
    const response = responses.shift();

    if (!response) {
      throw new Error(`No fake response configured for ${call.table ?? call.rpc}.`);
    }

    return Promise.resolve(response);
  }

  const client = {
    calls,
    from(table) {
      const call = { table, filters: [], operation: "select" };
      const builder = {
        select(columns) {
          call.columns = columns;
          return builder;
        },
        eq(column, value) {
          call.filters.push([column, "eq", value]);
          return builder;
        },
        gt(column, value) {
          call.filters.push([column, "gt", value]);
          return builder;
        },
        order(column, options) {
          call.order = [column, options];
          return builder;
        },
        insert(values) {
          call.operation = "insert";
          call.values = values;
          return builder;
        },
        maybeSingle() {
          return resolve(call);
        },
        single() {
          return resolve(call);
        },
        then(onFulfilled, onRejected) {
          return resolve(call).then(onFulfilled, onRejected);
        },
      };

      return builder;
    },
    rpc(name, args) {
      return resolve({ rpc: name, args });
    },
  };

  return client;
}

test("listsOnlyActiveFarmsInNameOrder", async () => {
  const client = createSupabaseFake([{ data: [farm], error: null }]);

  const result = await getActiveFarms(client);

  assert.deepEqual(result, [farm]);
  assert.deepEqual(client.calls[0].filters, [["is_active", "eq", true]]);
  assert.deepEqual(client.calls[0].order, ["name", { ascending: true }]);
});

test("selectsHomepageMetadataForActiveFarms", async () => {
  const client = createSupabaseFake([{ data: [farm], error: null }]);

  await getActiveFarms(client);

  assert.equal(
    client.calls[0].columns,
    "id,name,description,location,max_party_size,province,category,crops,headline,news_summary,is_trending,images,latitude,longitude",
  );
});

test("listsOnlyActiveSlotsForTheSelectedFarm", async () => {
  const client = createSupabaseFake([{ data: [timeSlot], error: null }]);

  const result = await getActiveTimeSlots(client, farmId);

  assert.deepEqual(result, [timeSlot]);
  assert.deepEqual(client.calls[0].filters, [
    ["farm_id", "eq", farmId],
    ["is_active", "eq", true],
  ]);
});

test("doesNotInsertWhenFarmIsInactiveOrMissing", async () => {
  const client = createSupabaseFake([{ data: null, error: null }]);

  await assert.rejects(
    createPendingReservation(validInput, "a".repeat(64), "b".repeat(64), client),
    (error) =>
      error.name === "ReservationValidationError" &&
      Boolean(error.errors.farmId),
  );
  assert.equal(client.calls.length, 1);
});

test("doesNotInsertWhenFarmGuestMaximumIsExceeded", async () => {
  const limitedFarm = { ...farm, max_party_size: 1 };
  const client = createSupabaseFake([
    { data: limitedFarm, error: null },
    { data: timeSlot, error: null },
  ]);

  await assert.rejects(
    createPendingReservation(
      { ...validInput, guestCount: 2 },
      "a".repeat(64),
      "b".repeat(64),
      client,
    ),
    (error) =>
      error.name === "ReservationValidationError" &&
      Boolean(error.errors.guestCount),
  );
  assert.equal(client.calls.some((call) => call.operation === "insert"), false);
});

test("createsPendingReservationWithOnlyTokenHashes", async () => {
  const inserted = { id: "reservation-id", status: "pending" };
  const client = createSupabaseFake([
    { data: farm, error: null },
    { data: timeSlot, error: null },
    { data: inserted, error: null },
  ]);

  const result = await createPendingReservation(
    validInput,
    "a".repeat(64),
    "b".repeat(64),
    client,
  );

  assert.deepEqual(result, {
    ...inserted,
    farm_name: farm.name,
    time_slot_label: timeSlot.label,
  });
  const insertCall = client.calls.find((call) => call.operation === "insert");
  assert.equal(insertCall.values.status, "pending");
  assert.equal(insertCall.values.admin_action_token_hash, "a".repeat(64));
  assert.equal(insertCall.values.ticket_email_retry_token_hash, "b".repeat(64));
  assert.equal("admin_action_token" in insertCall.values, false);
  assert.equal("ticket_email_retry_token" in insertCall.values, false);
});

test("returnsExplicitReasonForConsumedApprovalAction", async () => {
  const client = createSupabaseFake([
    {
      data: [
        {
          ok: false,
          reason: "used",
          reservation_id: null,
        },
      ],
      error: null,
    },
  ]);

  const result = await decideReservation("action-secret", "approve", "c".repeat(64), client);

  assert.deepEqual(result, { ok: false, reason: "used" });
  assert.deepEqual(client.calls[0], {
    rpc: "decide_reservation_action",
    args: {
      p_action_token_hash: hashToken("action-secret"),
      p_decision: "approve",
      p_ticket_token_hash: "c".repeat(64),
    },
  });
});

test("returnsOnlyArrivalFieldsForApprovedTicket", async () => {
  const client = createSupabaseFake([
    {
      data: {
        farm: { name: "Sagana Farm" },
        time_slot: { label: "Morning" },
        guest_count: 2,
        visit_date: "2099-01-01",
        status: "approved",
      },
      error: null,
    },
  ]);

  const result = await getApprovedTicket("ticket-secret", client);

  assert.deepEqual(result, {
    farmName: "Sagana Farm",
    timeSlotLabel: "Morning",
    guestCount: 2,
    visitDate: "2099-01-01",
    status: "approved",
  });
  assert.equal(/visitor_(name|email|phone)/.test(client.calls[0].columns), false);
  assert.ok(client.calls[0].filters.some(([column]) => column === "status"));
  assert.ok(client.calls[0].filters.some(([column]) => column === "ticket_expires_at"));
});

test("doesNotClaimRetryForUnapprovedReservation", async () => {
  const client = createSupabaseFake([{ data: [], error: null }]);

  const result = await claimTicketEmailRetry(
    "retry-secret",
    "d".repeat(64),
    client,
  );

  assert.equal(result, null);
  assert.deepEqual(client.calls[0], {
    rpc: "claim_ticket_email_retry",
    args: {
      p_retry_token_hash: hashToken("retry-secret"),
      p_replacement_ticket_token_hash: "d".repeat(64),
    },
  });
});

test("claimsRateLimitWithOnlyKeyedIdentifierHashes", async () => {
  const client = createSupabaseFake([
    {
      data: [{ allowed: false, retry_after_seconds: 900 }],
      error: null,
    },
  ]);

  const result = await claimReservationSubmissionRateLimit(
    "a".repeat(64),
    "b".repeat(64),
    client,
  );

  assert.deepEqual(result, { allowed: false, retryAfterSeconds: 900 });
  assert.deepEqual(client.calls[0], {
    rpc: "claim_reservation_submission_rate_limit",
    args: {
      p_ip_hash: "a".repeat(64),
      p_email_hash: "b".repeat(64),
    },
  });
});

test("surfacesSupabaseReadErrors", async () => {
  const error = new Error("database unavailable");
  const client = createSupabaseFake([{ data: null, error }]);

  await assert.rejects(getActiveFarms(client), error);
});
