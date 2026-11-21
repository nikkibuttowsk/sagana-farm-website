const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PH_MOBILE_PATTERN = /^(?:\+63|63|0)(9\d{9})$/;
const INTERNATIONAL_PATTERN = /^\+[1-9]\d{7,14}$/;

export class ReservationValidationError extends Error {
  constructor(errors) {
    super("Reservation details are invalid.");
    this.name = "ReservationValidationError";
    this.errors = errors;
  }
}

// Returns a clean number like +639171234567, or null if it isn't valid.
function normalizePhone(value) {
  // allow spaces, dashes, dots and brackets while typing: "0917 123-4567"
  const compact = value.replace(/[\s().-]/g, "");
  const ph = compact.match(PH_MOBILE_PATTERN);

  if (ph) {
    return `+63${ph[1]}`;
  }

  // a +63 number that isn't a valid mobile number is rejected
  if (compact.startsWith("+63")) {
    return null;
  }

  return INTERNATIONAL_PATTERN.test(compact) ? compact : null;
}

function manilaDate(date) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));

  return `${values.year}-${values.month}-${values.day}`;
}

function isCalendarDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);

  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

export function validateReservation(
  input,
  { maxPartySize = null, now = new Date() } = {},
) {
  const errors = {};
  const visitorName =
    typeof input?.visitorName === "string" ? input.visitorName.trim() : "";
  const visitorEmail =
    typeof input?.visitorEmail === "string"
      ? input.visitorEmail.trim().toLowerCase()
      : "";
  const rawPhone =
    typeof input?.visitorPhone === "string" ? input.visitorPhone.trim() : "";
  const visitorPhone = rawPhone.length <= 32 ? normalizePhone(rawPhone) : null;
  const farmId = typeof input?.farmId === "string" ? input.farmId : "";
  const timeSlotId =
    typeof input?.timeSlotId === "string" ? input.timeSlotId : "";
  const guestCount = input?.guestCount;
  const visitDate =
    typeof input?.visitDate === "string" ? input.visitDate : "";

  if (visitorName.length < 1 || visitorName.length > 120) {
    errors.visitorName = "Enter a name between 1 and 120 characters.";
  }

  if (
    visitorEmail.length > 254 ||
    !EMAIL_PATTERN.test(visitorEmail)
  ) {
    errors.visitorEmail = "Enter a valid email address.";
  }

  if (!visitorPhone) {
    errors.visitorPhone = "Enter a valid mobile number, like 0917 123 4567.";
  }

  if (!UUID_PATTERN.test(farmId)) {
    errors.farmId = "Choose a valid farm.";
  }

  if (!UUID_PATTERN.test(timeSlotId)) {
    errors.timeSlotId = "Choose a valid time slot.";
  }

  if (
    !Number.isInteger(guestCount) ||
    guestCount < 1 ||
    (maxPartySize !== null && guestCount > maxPartySize)
  ) {
    errors.guestCount = "Enter a valid guest count for this farm.";
  }

  if (!isCalendarDate(visitDate) || visitDate < manilaDate(now)) {
    errors.visitDate = "Choose a valid visit date that is not in the past.";
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      visitorName,
      visitorEmail,
      visitorPhone,
      farmId: farmId.toLowerCase(),
      timeSlotId: timeSlotId.toLowerCase(),
      guestCount,
      visitDate,
    },
  };
}