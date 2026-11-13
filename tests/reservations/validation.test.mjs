import assert from "node:assert/strict";
import test from "node:test";
import { validateReservation } from "../../src/lib/reservations/validation.mjs";

const farmId = "9d08750e-f7cb-4951-9c68-4f5b88af2e39";
const timeSlotId = "3e42d646-b6d1-4667-80e4-2265568fd4aa";
const now = new Date("2026-11-13T00:00:00.000Z");
const validInput = {
  visitorName: "  Maria Santos ",
  visitorEmail: " MARIA@example.com ",
  visitorPhone: "+63 (917) 123-4567",
  farmId,
  timeSlotId,
  guestCount: 2,
  visitDate: "2026-11-13",
};

test("rejectsMissingContactFields", () => {
  const result = validateReservation(
    { ...validInput, visitorName: " ", visitorEmail: "", visitorPhone: "" },
    { now },
  );

  assert.equal(result.ok, false);
  assert.ok(result.errors.visitorName);
  assert.ok(result.errors.visitorEmail);
  assert.ok(result.errors.visitorPhone);
});

test("rejectsMalformedEmailAndPhone", () => {
  const result = validateReservation(
    { ...validInput, visitorEmail: "not-an-email", visitorPhone: "call me" },
    { now },
  );

  assert.equal(result.ok, false);
  assert.ok(result.errors.visitorEmail);
  assert.ok(result.errors.visitorPhone);
});

test("rejectsInvalidDateOrGuestCount", () => {
  for (const [visitDate, guestCount] of [
    ["2026-02-30", 2],
    ["2026-11-12", 2],
    ["2026-11-13", 0],
    ["2026-11-13", 1.5],
  ]) {
    const result = validateReservation(
      { ...validInput, visitDate, guestCount },
      { now },
    );

    assert.equal(result.ok, false);
  }
});

test("rejectsInvalidFarmAndSlotIdentifiers", () => {
  const result = validateReservation(
    { ...validInput, farmId: "farm-one", timeSlotId: "slot-one" },
    { now },
  );

  assert.equal(result.ok, false);
  assert.ok(result.errors.farmId);
  assert.ok(result.errors.timeSlotId);
});

test("acceptsValidRequestAndNormalizesContactDetails", () => {
  const result = validateReservation(validInput, { now });

  assert.equal(result.ok, true);
  assert.deepEqual(result.value, {
    visitorName: "Maria Santos",
    visitorEmail: "maria@example.com",
    visitorPhone: "+63 (917) 123-4567",
    farmId,
    timeSlotId,
    guestCount: 2,
    visitDate: "2026-11-13",
  });
});

test("enforcesOptionalFarmGuestLimit", () => {
  const result = validateReservation(
    { ...validInput, guestCount: 4 },
    { maxPartySize: 3, now },
  );

  assert.equal(result.ok, false);
  assert.ok(result.errors.guestCount);
});
