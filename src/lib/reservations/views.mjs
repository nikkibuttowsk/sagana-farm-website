const RESERVATION_DECISION_MESSAGES = new Map([
  ["approved", "The reservation was approved."],
  ["rejected", "The reservation was rejected."],
  ["invalid", "This reservation action link is invalid."],
  ["expired", "This reservation action link has expired."],
  ["used", "This reservation action link has already been used."],
  ["not_pending", "This reservation is no longer awaiting a decision."],
  [
    "ticket_expired",
    "The visit date has passed; a ticket can no longer be issued.",
  ],
  ["error", "The reservation decision could not be completed."],
]);

const TICKET_EMAIL_RETRY_MESSAGES = new Map([
  ["sent", "A new ticket email has been sent."],
  ["unavailable", "This retry link is invalid or unavailable."],
  ["invalid", "This retry link is invalid or unavailable."],
  ["failed", "The ticket email could not be sent. Please wait a minute and try again."],
]);

export function buildReservationOutcomeView(result) {
  if (!result?.saved) {
    return { kind: "failed" };
  }

  return {
    kind: result.notificationSent ? "submitted" : "saved-not-notified",
    reference: result.reference,
  };
}

export function buildReservationDecisionView(status, email) {
  return {
    message:
      RESERVATION_DECISION_MESSAGES.get(status) ??
      RESERVATION_DECISION_MESSAGES.get("invalid"),
    emailFailed:
      (status === "approved" || status === "rejected") && email === "failed",
  };
}

export function buildTicketEmailRetryMessage(status) {
  return TICKET_EMAIL_RETRY_MESSAGES.get(status) ?? null;
}

export function buildTicketView(ticket) {
  if (
    !ticket ||
    ticket.status !== "approved" ||
    typeof ticket.farmName !== "string" ||
    typeof ticket.visitDate !== "string" ||
    typeof ticket.timeSlotLabel !== "string" ||
    !Number.isInteger(ticket.guestCount) ||
    ticket.guestCount < 1
  ) {
    return null;
  }

  return {
    farmName: ticket.farmName,
    visitDate: ticket.visitDate,
    timeSlotLabel: ticket.timeSlotLabel,
    guestCount: ticket.guestCount,
    status: ticket.status,
  };
}

export function buildFarmCatalogView(farms, slotsByFarm) {
  if (!Array.isArray(farms)) {
    throw new TypeError("Farm catalog must be an array.");
  }

  return farms
    .filter((farm) => farm.is_active !== false)
    .map((farm) => ({
      id: farm.id,
      name: farm.name,
      description: farm.description ?? "",
      location: farm.location ?? "",
      maxPartySize: farm.max_party_size ?? null,
      timeSlots: (slotsByFarm[farm.id] ?? [])
        .filter(
          (slot) =>
            slot.is_active !== false && slot.farm_id === farm.id,
        )
        .map((slot) => ({ id: slot.id, label: slot.label })),
    }));
}
