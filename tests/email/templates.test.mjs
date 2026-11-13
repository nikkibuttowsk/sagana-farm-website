import assert from "node:assert/strict";
import test from "node:test";
import {
  createAdminReservationMessage,
  createVisitorStatusMessage,
} from "../../src/lib/email/templates.mjs";

const reservation = {
  visitor_name: "<Maria Santos>",
  visitor_email: "maria@example.com",
  visitor_phone: "+639171234567",
  farm_name: "Sagana & Sons Farm",
  visit_date: "2099-01-01",
  time_slot_label: "Morning",
  guest_count: 2,
};

test("adminMessageHasSeparateApproveRejectAndRetryActions", () => {
  const message = createAdminReservationMessage(reservation, {
    actionUrl: "https://sagana.example/reservation/action?token=action-secret",
    retryUrl:
      "https://sagana.example/reservation/ticket-email?token=retry-secret",
    from: "visits@sagana.example",
    to: "admin@sagana.example",
  });

  assert.equal(message.from, "visits@sagana.example");
  assert.equal(message.to, "admin@sagana.example");
  assert.match(message.html, /value="approve"/);
  assert.match(message.html, /value="reject"/);
  assert.match(message.html, /retry-secret/);
  assert.match(message.text, /Sagana & Sons Farm/);
  assert.match(message.text, /Review and decide:/);
  assert.doesNotMatch(message.text, /&decision=/);
  assert.match(message.html, /&lt;Maria Santos&gt;/);
  assert.match(message.html, /Sagana &amp; Sons Farm/);
});

test("approvedVisitorMessageIncludesTicketAndQrWhileRejectionDoesNot", () => {
  const approved = createVisitorStatusMessage(
    reservation,
    "approved",
    {
      ticketUrl: "https://sagana.example/ticket/opaque-ticket",
      qrDataUrl: "data:image/png;base64,abc",
    },
    { from: "visits@sagana.example" },
  );
  const rejected = createVisitorStatusMessage(
    reservation,
    "rejected",
    {},
    { from: "visits@sagana.example" },
  );

  assert.equal(approved.to, reservation.visitor_email);
  assert.match(approved.html, /opaque-ticket/);
  assert.match(approved.html, /data:image\/png;base64,abc/);
  assert.match(approved.text, /approved/);
  assert.doesNotMatch(rejected.html, /opaque-ticket|base64/);
  assert.match(rejected.text, /rejected/);
});
