import { hashToken } from "./tokens.mjs";
import {
  ReservationValidationError,
  validateReservation,
} from "./validation.mjs";

const TOKEN_HASH_PATTERN = /^[0-9a-f]{64}$/;
const APPROVAL_LIFETIME_MS = 72 * 60 * 60 * 1000;
const RETRY_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

function assertTokenHash(value, name) {
  if (typeof value !== "string" || !TOKEN_HASH_PATTERN.test(value)) {
    throw new TypeError(`${name} must be a SHA-256 token hash.`);
  }
}

function throwOnError(error) {
  if (error) {
    throw error;
  }
}

export async function getActiveFarms(client) {
  const { data, error } = await client
    .from("farms")
    .select(
      "id,name,description,location,max_party_size,province,category,crops,headline,news_summary,is_trending,images,latitude,longitude",
    )
    .eq("is_active", true)
    .order("name", { ascending: true });

  throwOnError(error);

  if (!Array.isArray(data)) {
    throw new Error("Supabase returned an invalid farm list.");
  }

  return data;
}

export async function getActiveTimeSlots(client, farmId) {
  const { data, error } = await client
    .from("farm_time_slots")
    .select("id,farm_id,label,sort_order")
    .eq("farm_id", farmId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  throwOnError(error);

  if (!Array.isArray(data)) {
    throw new Error("Supabase returned an invalid time-slot list.");
  }

  return data;
}

export async function createPendingReservation(
  input,
  actionTokenHash,
  retryTokenHash,
  client,
) {
  assertTokenHash(actionTokenHash, "actionTokenHash");
  assertTokenHash(retryTokenHash, "retryTokenHash");

  const { data: farm, error: farmError } = await client
    .from("farms")
    .select("id,name,max_party_size")
    .eq("id", input.farmId)
    .eq("is_active", true)
    .maybeSingle();

  throwOnError(farmError);

  if (!farm) {
    throw new ReservationValidationError({ farmId: "Choose an active farm." });
  }

  const { data: slot, error: slotError } = await client
    .from("farm_time_slots")
    .select("id,farm_id,label")
    .eq("id", input.timeSlotId)
    .eq("farm_id", input.farmId)
    .eq("is_active", true)
    .maybeSingle();

  throwOnError(slotError);

  if (!slot) {
    throw new ReservationValidationError({
      timeSlotId: "Choose an active time slot for this farm.",
    });
  }

  const validation = validateReservation(input, {
    maxPartySize: farm.max_party_size,
  });

  if (!validation.ok) {
    throw new ReservationValidationError(validation.errors);
  }

  const now = new Date();
  const { value } = validation;
  const reservation = {
    farm_id: farm.id,
    time_slot_id: slot.id,
    visitor_name: value.visitorName,
    visitor_email: value.visitorEmail,
    visitor_phone: value.visitorPhone,
    guest_count: value.guestCount,
    visit_date: value.visitDate,
    status: "pending",
    admin_action_token_hash: actionTokenHash,
    admin_action_expires_at: new Date(
      now.getTime() + APPROVAL_LIFETIME_MS,
    ).toISOString(),
    ticket_email_retry_token_hash: retryTokenHash,
    ticket_email_retry_expires_at: new Date(
      now.getTime() + RETRY_LIFETIME_MS,
    ).toISOString(),
  };
  const { data, error } = await client
    .from("reservations")
    .insert(reservation)
    .select(
      "id,farm_id,time_slot_id,visitor_name,visitor_email,visitor_phone,guest_count,visit_date,status,created_at",
    )
    .single();

  throwOnError(error);

  if (!data) {
    throw new Error("Supabase did not return the saved reservation.");
  }

  return {
    ...data,
    farm_name: farm.name,
    time_slot_label: slot.label,
  };
}

export async function decideReservation(
  actionToken,
  decision,
  ticketTokenHash,
  client,
) {
  if (decision !== "approve" && decision !== "reject") {
    throw new TypeError("Decision must be approve or reject.");
  }

  if (decision === "approve") {
    assertTokenHash(ticketTokenHash, "ticketTokenHash");
  }

  const { data, error } = await client.rpc("decide_reservation_action", {
    p_action_token_hash: hashToken(actionToken),
    p_decision: decision,
    p_ticket_token_hash: decision === "approve" ? ticketTokenHash : null,
  });

  throwOnError(error);

  const result = Array.isArray(data) ? data[0] : data;

  if (!result?.ok) {
    return {
      ok: false,
      reason: result?.reason ?? "invalid",
    };
  }

  const { reservation_id: id, ...reservation } = result;

  return { ok: true, reservation: { id, ...reservation } };
}

export async function getApprovedTicket(ticketToken, client) {
  const { data, error } = await client
    .from("reservations")
    .select(
      "farm:farms!reservations_farm_id_fkey(name),time_slot:farm_time_slots!reservations_farm_slot_fkey(label),guest_count,visit_date,status",
    )
    .eq("ticket_token_hash", hashToken(ticketToken))
    .eq("status", "approved")
    .gt("ticket_expires_at", new Date().toISOString())
    .maybeSingle();

  throwOnError(error);

  if (!data) {
    return null;
  }

  return {
    farmName: data.farm?.name,
    timeSlotLabel: data.time_slot?.label,
    guestCount: data.guest_count,
    visitDate: data.visit_date,
    status: data.status,
  };
}

export async function claimReservationSubmissionRateLimit(
  ipHash,
  emailHash,
  client,
) {
  assertTokenHash(ipHash, "ipHash");
  assertTokenHash(emailHash, "emailHash");

  const { data, error } = await client.rpc(
    "claim_reservation_submission_rate_limit",
    {
      p_ip_hash: ipHash,
      p_email_hash: emailHash,
    },
  );

  throwOnError(error);

  const result = Array.isArray(data) ? data[0] : data;

  if (typeof result?.allowed !== "boolean") {
    throw new Error("Supabase returned an invalid reservation rate-limit result.");
  }

  if (!result.allowed) {
    if (
      !Number.isInteger(result.retry_after_seconds) ||
      result.retry_after_seconds < 1
    ) {
      throw new Error("Supabase returned an invalid rate-limit retry delay.");
    }

    return {
      allowed: false,
      retryAfterSeconds: result.retry_after_seconds,
    };
  }

  return { allowed: true };
}

export async function claimTicketEmailRetry(
  retryToken,
  replacementTicketTokenHash,
  client,
) {
  assertTokenHash(replacementTicketTokenHash, "replacementTicketTokenHash");

  const { data, error } = await client.rpc("claim_ticket_email_retry", {
    p_retry_token_hash: hashToken(retryToken),
    p_replacement_ticket_token_hash: replacementTicketTokenHash,
  });

  throwOnError(error);

  const reservation = Array.isArray(data) ? data[0] : data;

  if (!reservation?.reservation_id) {
    return null;
  }

  const { reservation_id: id, ...details } = reservation;

  return { id, ...details };
}
