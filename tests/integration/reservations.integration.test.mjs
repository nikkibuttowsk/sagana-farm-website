import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { after, before, test } from "node:test";
import { createSupabaseServerClient } from "../../src/lib/supabase/client-factory.mjs";
import { hashToken } from "../../src/lib/reservations/tokens.mjs";
import { hashRateLimitIdentifier } from "../../src/lib/reservations/rate-limit.mjs";

function readStatusFile(path) {
  if (!path) {
    return {};
  }

  return Object.fromEntries(
    readFileSync(path, "utf8")
      .split(/\r?\n/)
      .map((line) => line.match(/^([A-Z0-9_]+)=(.*)$/))
      .filter(Boolean)
      .map(([, key, value]) => [key, value.replace(/^["']|["']$/g, "")]),
  );
}

const localEnv = readStatusFile(process.env.SUPABASE_TEST_STATUS_FILE);
const supabaseUrl =
  process.env.SUPABASE_TEST_URL ?? localEnv.API_URL ?? localEnv.SUPABASE_URL;
const serviceRoleKey =
  process.env.SUPABASE_TEST_SERVICE_ROLE_KEY ??
  localEnv.SERVICE_ROLE_KEY ??
  localEnv.SUPABASE_SERVICE_ROLE_KEY;
const anonKey =
  process.env.SUPABASE_TEST_ANON_KEY ??
  localEnv.ANON_KEY ??
  localEnv.SUPABASE_ANON_KEY;
const integrationTest =
  supabaseUrl && serviceRoleKey && anonKey ? test : test.skip;
const admin = integrationTest === test
  ? createSupabaseServerClient(supabaseUrl, serviceRoleKey)
  : null;
const anon = integrationTest === test
  ? createSupabaseServerClient(supabaseUrl, anonKey)
  : null;
const testSecret = randomBytes(32).toString("hex");
const rateLimitHashes = [];
let farmId;
let activeSlotId;
let inactiveSlotId;
let reservationIds = [];

function futureDate(days) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

function pastDate(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

async function createPendingReservation({
  actionToken = randomBytes(32).toString("base64url"),
  visitDate = futureDate(7),
  actionExpiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  actionUsedAt = null,
  status = "pending",
} = {}) {
  const reservation = {
    farm_id: farmId,
    time_slot_id: activeSlotId,
    visitor_name: "Integration Visitor",
    visitor_email: "integration@example.test",
    visitor_phone: "+639171234567",
    guest_count: 2,
    visit_date: visitDate,
    status,
    admin_action_token_hash: hashToken(actionToken),
    admin_action_expires_at: actionExpiresAt,
    admin_action_used_at: actionUsedAt,
    ticket_email_retry_token_hash: hashToken(
      randomBytes(32).toString("base64url"),
    ),
    ticket_email_retry_expires_at: new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000,
    ).toISOString(),
  };
  const { data, error } = await admin
    .from("reservations")
    .insert(reservation)
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  reservationIds.push(data.id);

  return { id: data.id, actionToken };
}

async function decision(token, choice) {
  const { data, error } = await admin.rpc("decide_reservation_action", {
    p_action_token_hash: hashToken(token),
    p_decision: choice,
    p_ticket_token_hash:
      choice === "approve"
        ? hashToken(randomBytes(32).toString("base64url"))
        : null,
  });

  if (error) {
    throw error;
  }

  return Array.isArray(data) ? data[0] : data;
}

async function rateLimit(ipValue, emailValue) {
  const ipHash = hashRateLimitIdentifier("ip", ipValue, testSecret);
  const emailHash = hashRateLimitIdentifier("email", emailValue, testSecret);

  rateLimitHashes.push(ipHash, emailHash);

  const { data, error } = await admin.rpc(
    "claim_reservation_submission_rate_limit",
    { p_ip_hash: ipHash, p_email_hash: emailHash },
  );

  if (error) {
    throw error;
  }

  return Array.isArray(data) ? data[0] : data;
}

async function readVisibleRows(query) {
  let result;

  for (let attempt = 0; attempt < 20; attempt += 1) {
    result = await query();
    if (result.error || result.data?.length) {
      return result;
    }

    await new Promise((resolve) => setTimeout(resolve, 25));
  }

  return result;
}

async function deleteRows(query) {
  const { error } = await query;
  if (error) {
    throw error;
  }
}

before(async () => {
  if (!admin) {
    return;
  }

  farmId = randomUUID();
  activeSlotId = randomUUID();
  inactiveSlotId = randomUUID();
  const { error: farmError } = await admin
    .from("farms")
    .insert({
      id: farmId,
      name: `Integration Farm ${farmId}`,
      description: "Temporary database test fixture",
      location: "Test",
      is_active: true,
      max_party_size: 4,
    })
    .select("id")
    .single();

  if (farmError) {
    throw farmError;
  }

  const { error: slotError } = await admin.from("farm_time_slots").insert([
    {
      id: activeSlotId,
      farm_id: farmId,
      label: "Active slot",
      is_active: true,
    },
    {
      id: inactiveSlotId,
      farm_id: farmId,
      label: "Inactive slot",
      is_active: false,
    },
  ]);

  if (slotError) {
    throw slotError;
  }
});

after(async () => {
  if (!admin || !farmId) {
    return;
  }

  if (reservationIds.length) {
    await deleteRows(admin.from("reservations").delete().in("id", reservationIds));
  }
  if (rateLimitHashes.length) {
    await deleteRows(
      admin
        .from("reservation_submission_limits")
        .delete()
        .in("identifier_hash", [...new Set(rateLimitHashes)]),
    );
  }
  await deleteRows(admin.from("farm_time_slots").delete().eq("farm_id", farmId));
  await deleteRows(admin.from("farms").delete().eq("id", farmId));
});

integrationTest("public can read active catalog records but not reservations", async () => {
  const { data: farms, error: farmError } = await readVisibleRows(() =>
    anon
      .from("farms")
      .select(
        "id,is_active,max_party_size,province,category,crops,headline,news_summary,is_trending,images,latitude,longitude",
      )
      .eq("id", farmId),
  );
  const { data: slots, error: slotError } = await readVisibleRows(() =>
    anon.from("farm_time_slots").select("id,is_active").eq("farm_id", farmId),
  );
  const { error: reservationError } = await anon
    .from("reservations")
    .select("id")
    .limit(1);

  assert.ifError(farmError);
  assert.ifError(slotError);
  assert.equal(farms.length, 1);
  assert.equal(farms[0].id, farmId);
  assert.equal(farms[0].is_active, true);
  assert.equal(farms[0].max_party_size, 4);
  for (const column of [
    "province",
    "category",
    "crops",
    "headline",
    "news_summary",
    "is_trending",
    "images",
    "latitude",
    "longitude",
  ]) {
    assert.ok(Object.hasOwn(farms[0], column), `missing farm column ${column}`);
  }
  assert.deepEqual(slots, [{ id: activeSlotId, is_active: true }]);
  assert.ok(reservationError);
});

integrationTest("rejects forged expired used and non-pending administrator actions", async () => {
  const expiredAction = await createPendingReservation({
    actionExpiresAt: new Date(Date.now() - 60 * 1000).toISOString(),
  });
  const usedAction = await createPendingReservation({
    actionUsedAt: new Date().toISOString(),
  });
  const rejectedReservation = await createPendingReservation({
    status: "rejected",
  });

  assert.equal((await decision("forged-token", "approve")).reason, "invalid");
  assert.equal((await decision(expiredAction.actionToken, "approve")).reason, "expired");
  assert.equal((await decision(usedAction.actionToken, "approve")).reason, "used");
  assert.equal(
    (await decision(rejectedReservation.actionToken, "approve")).reason,
    "not_pending",
  );
});

integrationTest("does not approve a visit after its ticket expiration", async () => {
  const reservation = await createPendingReservation({ visitDate: pastDate(3) });

  assert.equal(
    (await decision(reservation.actionToken, "approve")).reason,
    "ticket_expired",
  );
});

integrationTest("serializes competing approval and rejection decisions", async () => {
  const reservation = await createPendingReservation();
  const [approval, rejection] = await Promise.all([
    decision(reservation.actionToken, "approve"),
    decision(reservation.actionToken, "reject"),
  ]);
  const results = [approval, rejection];

  assert.equal(results.filter((result) => result.ok).length, 1);
  assert.equal(results.filter((result) => result.reason === "used").length, 1);
});

integrationTest("enforces IP and email rate windows atomically", async () => {
  const unique = randomUUID();
  const ipValue = `192.0.2.${Math.floor(Math.random() * 200) + 1}-${unique}`;
  const emailValue = `visitor-${unique}@example.test`;
  const deniedAnonymousCall = await anon.rpc(
    "claim_reservation_submission_rate_limit",
    {
      p_ip_hash: hashRateLimitIdentifier("ip", ipValue, testSecret),
      p_email_hash: hashRateLimitIdentifier("email", emailValue, testSecret),
    },
  );
  const ipRequests = await Promise.all(
    Array.from({ length: 6 }, (_, index) =>
      rateLimit(ipValue, `${index}-${emailValue}`),
    ),
  );

  assert.ok(deniedAnonymousCall.error);
  assert.equal(ipRequests.filter(({ allowed }) => allowed).length, 5);
  assert.equal(ipRequests.filter(({ allowed }) => !allowed).length, 1);
  assert.ok(
    ipRequests.some(
      ({ allowed, retry_after_seconds: retryAfter }) =>
        !allowed && retryAfter > 0,
    ),
  );

  const emailRequests = await Promise.all(
    Array.from({ length: 4 }, (_, index) =>
      rateLimit(`${index}-${unique}`, emailValue),
    ),
  );

  assert.equal(emailRequests.filter(({ allowed }) => allowed).length, 3);
  assert.equal(emailRequests.filter(({ allowed }) => !allowed).length, 1);
  assert.ok(
    emailRequests.some(
      ({ allowed, retry_after_seconds: retryAfter }) =>
        !allowed && retryAfter > 0,
    ),
  );
});
