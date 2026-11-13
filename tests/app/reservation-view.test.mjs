import assert from "node:assert/strict";
import test from "node:test";
import {
  buildFarmCatalogView,
  buildReservationDecisionView,
  buildReservationOutcomeView,
  buildTicketEmailRetryMessage,
  buildTicketView,
} from "../../src/lib/reservations/views.mjs";

test("mapsSuccessfulAndSavedButNotNotifiedReservationOutcomes", () => {
  assert.deepEqual(
    buildReservationOutcomeView({
      saved: true,
      reference: "reservation-reference",
      notificationSent: true,
    }),
    {
      kind: "submitted",
      reference: "reservation-reference",
    },
  );
  assert.deepEqual(
    buildReservationOutcomeView({
      saved: true,
      reference: "reservation-reference",
      notificationSent: false,
    }),
    {
      kind: "saved-not-notified",
      reference: "reservation-reference",
    },
  );
});

test("mapsOnlyAllowedApprovedTicketFields", () => {
  const view = buildTicketView({
    farmName: "Sagana Farm",
    visitDate: "2099-01-01",
    timeSlotLabel: "Morning",
    guestCount: 2,
    status: "approved",
    visitorEmail: "private@example.com",
    ticketToken: "private-token",
  });

  assert.deepEqual(view, {
    farmName: "Sagana Farm",
    visitDate: "2099-01-01",
    timeSlotLabel: "Morning",
    guestCount: 2,
    status: "approved",
  });
  assert.equal(buildTicketView(null), null);
  assert.equal(buildTicketView({ ...view, status: "pending" }), null);
});

test("buildsCatalogFromActiveFarmsAndTheirActiveSlots", () => {
  const farms = [
    {
      id: "farm-1",
      name: "Sagana Farm",
      description: "A family farm",
      location: "Rizal",
      max_party_size: 4,
      is_active: true,
    },
    { id: "farm-2", name: "Closed Farm", is_active: false },
  ];
  const slotsByFarm = {
    "farm-1": [
      { id: "slot-1", farm_id: "farm-1", label: "Morning", is_active: true },
      { id: "slot-2", farm_id: "farm-1", label: "Closed", is_active: false },
    ],
    "farm-2": [
      { id: "slot-3", farm_id: "farm-2", label: "Morning", is_active: true },
    ],
  };

  assert.deepEqual(buildFarmCatalogView(farms, slotsByFarm), [
    {
      id: "farm-1",
      name: "Sagana Farm",
      description: "A family farm",
      location: "Rizal",
      maxPartySize: 4,
      timeSlots: [{ id: "slot-1", label: "Morning" }],
    },
  ]);
  assert.deepEqual(buildFarmCatalogView([], {}), []);
});

test("safelyFallsBackForUnknownActionAndRetryStatuses", () => {
  assert.deepEqual(buildReservationDecisionView("__proto__", "sent"), {
    message: "This reservation action link is invalid.",
    emailFailed: false,
  });
  assert.deepEqual(buildReservationDecisionView("approved", "failed"), {
    message: "The reservation was approved.",
    emailFailed: true,
  });
  assert.deepEqual(buildReservationDecisionView("ticket_expired", "failed"), {
    message: "The visit date has passed; a ticket can no longer be issued.",
    emailFailed: false,
  });
  assert.equal(buildTicketEmailRetryMessage("toString"), null);
});
