"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import styles from "./reservation.module.css";

const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

function parseIsoDate(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split("-").map(Number);
  return { year: y, month: m - 1, day: d };
}

function toIsoDate(year, monthIndex, day) {
  const m = String(monthIndex + 1).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

function formatReadableDate(iso) {
  const parsed = parseIsoDate(iso);
  if (!parsed) return "Select a date";
  const date = new Date(Date.UTC(parsed.year, parsed.month, parsed.day));
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export default function ReservationForm({ farms, initialFarmId, minDate }) {
  const initialParsed = parseIsoDate(minDate) ?? {
    year: 2026,
    month: 10,
    day: 14,
  };

  const [step, setStep] = useState(1);
  const [farmId, setFarmId] = useState(
    farms.some((farm) => farm.id === initialFarmId)
      ? initialFarmId
      : farms[0]?.id ?? "",
  );
  const [viewYear, setViewYear] = useState(initialParsed.year);
  const [viewMonth, setViewMonth] = useState(initialParsed.month);
  const [visitDate, setVisitDate] = useState(minDate || "");
  const [timeSlotId, setTimeSlotId] = useState("");
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);

  const [visitorName, setVisitorName] = useState("");
  const [visitorEmail, setVisitorEmail] = useState("");
  const [visitorPhone, setVisitorPhone] = useState("");
  const [website, setWebsite] = useState("");

  const [errors, setErrors] = useState({});
  const [notice, setNotice] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const selectedFarm = farms.find((farm) => farm.id === farmId);
  const timeSlots = selectedFarm?.timeSlots ?? [];
  const selectedSlot = timeSlots.find((s) => s.id === timeSlotId);
  const totalGuests = adults + children;
  const maxParty = selectedFarm?.maxPartySize ?? 50;

  const calendarDays = useMemo(() => {
    const firstWeekday = new Date(Date.UTC(viewYear, viewMonth, 1)).getUTCDay();
    const daysInMonth = new Date(
      Date.UTC(viewYear, viewMonth + 1, 0),
    ).getUTCDate();

    const cells = [];
    for (let i = 0; i < firstWeekday; i += 1) {
      cells.push(null);
    }
    for (let d = 1; d <= daysInMonth; d += 1) {
      const iso = toIsoDate(viewYear, viewMonth, d);
      cells.push({
        day: d,
        iso,
        disabled: Boolean(minDate && iso < minDate),
      });
    }
    return cells;
  }, [viewYear, viewMonth, minDate]);

  const monthLabel = useMemo(() => {
    const d = new Date(Date.UTC(viewYear, viewMonth, 1));
    return new Intl.DateTimeFormat("en-US", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(d);
  }, [viewYear, viewMonth]);

  function changeMonth(delta) {
    const next = new Date(Date.UTC(viewYear, viewMonth + delta, 1));
    setViewYear(next.getUTCFullYear());
    setViewMonth(next.getUTCMonth());
  }

  function resetForm() {
    setStep(1);
    setFarmId(
      farms.some((farm) => farm.id === initialFarmId)
        ? initialFarmId
        : farms[0]?.id ?? "",
    );
    setViewYear(initialParsed.year);
    setViewMonth(initialParsed.month);
    setVisitDate(minDate || "");
    setTimeSlotId("");
    setAdults(1);
    setChildren(0);
    setVisitorName("");
    setVisitorEmail("");
    setVisitorPhone("");
    setWebsite("");
    setErrors({});
    setNotice(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleContinueStep1() {
    const stepErrors = {};
    if (!farmId) stepErrors.farmId = "Please select a farm.";
    if (!visitDate) stepErrors.visitDate = "Please select a visit date.";
    if (!timeSlotId) stepErrors.timeSlotId = "Please choose a time slot.";
    if (totalGuests < 1) {
      stepErrors.guestCount = "At least 1 guest is required.";
    } else if (
      selectedFarm?.maxPartySize &&
      totalGuests > selectedFarm.maxPartySize
    ) {
      stepErrors.guestCount = `Maximum ${selectedFarm.maxPartySize} guests per reservation.`;
    }

    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors);
      return;
    }

    setErrors({});
    setStep(2);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setErrors({});
    setNotice(null);
    setSubmitting(true);

    const payload = {
      visitorName,
      visitorEmail,
      visitorPhone,
      farmId,
      timeSlotId,
      guestCount: totalGuests,
      visitDate,
      website,
    };

    try {
      const response = await fetch("/api/reservations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();

      if (result.saved) {
        setNotice({
          kind: result.notificationSent ? "submitted" : "saved-not-notified",
          reference: result.reference,
        });
        setStep(3);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        setErrors(result.errors ?? {});
        setNotice({
          kind: "failed",
          message: result.error ?? "Your request could not be submitted.",
        });
        if (
          result.errors?.visitDate ||
          result.errors?.timeSlotId ||
          result.errors?.guestCount ||
          result.errors?.farmId
        ) {
          setStep(1);
        }
      }
    } catch {
      setNotice({
        kind: "failed",
        message: "We could not reach the reservation service. Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  function fieldError(name) {
    return errors[name] ? (
      <span className={styles.fieldError} role="alert">
        {errors[name]}
      </span>
    ) : null;
  }

  if (farms.length === 0) {
    return (
      <div className={styles.wrapper}>
        <section className={styles.notice}>
          There are no farms currently accepting visit requests.
        </section>
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      {/* Top Stepper */}
      <nav className={styles.stepper} aria-label="Reservation progress">
        <div
          className={`${styles.stepItem} ${step >= 1 ? styles.stepActive : ""}`}
        >
          <span className={styles.stepDot}>{step > 1 ? "✓" : "1"}</span>
          <span className={styles.stepLabel}>Plan Visit</span>
        </div>
        <div
          className={`${styles.stepLine} ${step >= 2 ? styles.stepLineActive : ""}`}
        />
        <div
          className={`${styles.stepItem} ${step >= 2 ? styles.stepActive : ""}`}
        >
          <span className={styles.stepDot}>{step > 2 ? "✓" : "2"}</span>
          <span className={styles.stepLabel}>Your Details</span>
        </div>
        <div
          className={`${styles.stepLine} ${step >= 3 ? styles.stepLineActive : ""}`}
        />
        <div
          className={`${styles.stepItem} ${step >= 3 ? styles.stepActive : ""}`}
        >
          <span className={styles.stepDot}>3</span>
          <span className={styles.stepLabel}>Confirmation</span>
        </div>
      </nav>

      {/* STEP 1: PLAN YOUR FARM DAY */}
      {step === 1 && (
        <div className={styles.stepContainer}>
          <header className={styles.stepHeader}>
            <h1>Plan your farm day</h1>
            <p>
              Pick the farm, date, time slot, and group size for your visit.
            </p>
          </header>

          {/* Farm Card Selector */}
          <section className={styles.card}>
            <div className={styles.farmCardRow}>
              <img
                src={selectedFarm?.imageUrl || "/farm-placeholder.svg"}
                alt=""
                className={styles.farmThumb}
                onError={(e) => {
                  e.currentTarget.src = "/farm-placeholder.svg";
                }}
              />
              <div className={styles.farmMeta}>
                <span className={styles.eyebrow}>Selected Farm</span>
                <h2 className={styles.farmTitle}>{selectedFarm?.name}</h2>
                <p className={styles.farmLocation}>{selectedFarm?.location}</p>
              </div>
              {farms.length > 1 && (
                <div className={styles.farmSwitch}>
                  <label htmlFor="farmId" className={styles.srOnly}>
                    Change farm
                  </label>
                  <select
                    id="farmId"
                    value={farmId}
                    onChange={(e) => {
                      setFarmId(e.target.value);
                      setTimeSlotId("");
                    }}
                    className={styles.selectSmall}
                  >
                    {farms.map((farm) => (
                      <option key={farm.id} value={farm.id}>
                        {farm.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            {fieldError("farmId")}
          </section>

          {/* Calendar Card */}
          <section className={styles.card}>
            <div className={styles.cardTopRow}>
              <h3 className={styles.cardHeading}>Choose your date</h3>
              <span className={styles.tzBadge}>Philippine Time (PHT)</span>
            </div>

            <div className={styles.calendarHeader}>
              <button
                type="button"
                className={styles.calNavBtn}
                onClick={() => changeMonth(-1)}
                aria-label="Previous month"
              >
                &lsaquo;
              </button>
              <strong className={styles.calMonthLabel}>{monthLabel}</strong>
              <button
                type="button"
                className={styles.calNavBtn}
                onClick={() => changeMonth(1)}
                aria-label="Next month"
              >
                &rsaquo;
              </button>
            </div>

            <div className={styles.calendarGrid}>
              {WEEKDAYS.map((day) => (
                <div key={day} className={styles.calWeekday}>
                  {day}
                </div>
              ))}
              {calendarDays.map((cell, idx) =>
                cell === null ? (
                  <div key={`empty-${idx}`} className={styles.calEmpty} />
                ) : (
                  <button
                    key={cell.iso}
                    type="button"
                    disabled={cell.disabled}
                    onClick={() => setVisitDate(cell.iso)}
                    className={`${styles.calDay} ${
                      visitDate === cell.iso ? styles.calDaySelected : ""
                    }`}
                  >
                    {cell.day}
                  </button>
                ),
              )}
            </div>

            <div className={styles.selectedDateBar}>
              <span>Selected date:</span>
              <strong>{formatReadableDate(visitDate)}</strong>
            </div>
            {fieldError("visitDate")}
          </section>

          {/* Time Slot Card */}
          <section className={styles.card}>
            <h3 className={styles.cardHeading}>Choose your time</h3>
            {timeSlots.length === 0 ? (
              <p className={styles.mutedText}>
                No active time slots are configured for this farm yet.
              </p>
            ) : (
              <div className={styles.slotGrid}>
                {timeSlots.map((slot) => {
                  const active = timeSlotId === slot.id;
                  return (
                    <button
                      key={slot.id}
                      type="button"
                      onClick={() => setTimeSlotId(slot.id)}
                      className={`${styles.slotPill} ${
                        active ? styles.slotPillSelected : ""
                      }`}
                    >
                      {slot.label}
                    </button>
                  );
                })}
              </div>
            )}
            {fieldError("timeSlotId")}
          </section>

          {/* Guest Counter Card */}
          <section className={styles.card}>
            <div className={styles.cardTopRow}>
              <h3 className={styles.cardHeading}>Who&apos;s coming?</h3>
              {selectedFarm?.maxPartySize && (
                <span className={styles.mutedText}>
                  Max {selectedFarm.maxPartySize} guests
                </span>
              )}
            </div>

            <div className={styles.guestRow}>
              <div>
                <div className={styles.guestType}>Adults</div>
                <div className={styles.guestSub}>Ages 13 and above</div>
              </div>
              <div className={styles.counterControls}>
                <button
                  type="button"
                  className={styles.counterBtn}
                  onClick={() => setAdults((a) => Math.max(1, a - 1))}
                  disabled={adults <= 1}
                  aria-label="Decrease adults"
                >
                  &minus;
                </button>
                <span className={styles.counterValue}>{adults}</span>
                <button
                  type="button"
                  className={styles.counterBtn}
                  onClick={() =>
                    setAdults((a) => (totalGuests < maxParty ? a + 1 : a))
                  }
                  disabled={totalGuests >= maxParty}
                  aria-label="Increase adults"
                >
                  +
                </button>
              </div>
            </div>

            <div className={styles.guestRow}>
              <div>
                <div className={styles.guestType}>Children</div>
                <div className={styles.guestSub}>Ages 12 and below</div>
              </div>
              <div className={styles.counterControls}>
                <button
                  type="button"
                  className={styles.counterBtn}
                  onClick={() => setChildren((c) => Math.max(0, c - 1))}
                  disabled={children <= 0}
                  aria-label="Decrease children"
                >
                  &minus;
                </button>
                <span className={styles.counterValue}>{children}</span>
                <button
                  type="button"
                  className={styles.counterBtn}
                  onClick={() =>
                    setChildren((c) => (totalGuests < maxParty ? c + 1 : c))
                  }
                  disabled={totalGuests >= maxParty}
                  aria-label="Increase children"
                >
                  +
                </button>
              </div>
            </div>

            {fieldError("guestCount")}
          </section>

          <button
            type="button"
            className={styles.primaryCta}
            onClick={handleContinueStep1}
            disabled={timeSlots.length === 0}
          >
            Continue &rarr;
          </button>
        </div>
      )}

      {/* STEP 2: PERSONAL DETAILS */}
      {step === 2 && (
        <div className={styles.stepContainer}>
          <header className={styles.stepHeader}>
            <button
              type="button"
              className={styles.backLink}
              onClick={() => setStep(1)}
            >
              &larr; Back to date &amp; time
            </button>
            <h1>Your details, then you&apos;re set</h1>
            <p>
              We&apos;ll send your visit confirmation and QR pass to this email
              once the farm approves your request.
            </p>
          </header>

          {notice?.kind === "failed" && (
            <div className={`${styles.notice} ${styles.error}`} role="alert">
              {notice.message}
            </div>
          )}

          {/* Compact Summary Card */}
          <section className={styles.card}>
            <div className={styles.farmCardRow}>
              <img
                src={selectedFarm?.imageUrl || "/farm-placeholder.svg"}
                alt=""
                className={styles.farmThumbSmall}
                onError={(e) => {
                  e.currentTarget.src = "/farm-placeholder.svg";
                }}
              />
              <div className={styles.farmMeta}>
                <h2 className={styles.farmTitle}>{selectedFarm?.name}</h2>
                <p className={styles.farmLocation}>
                  {formatReadableDate(visitDate)} &bull; {selectedSlot?.label}{" "}
                  &bull; {totalGuests}{" "}
                  {totalGuests === 1 ? "guest" : "guests"}
                </p>
              </div>
              <button
                type="button"
                className={styles.editBtn}
                onClick={() => setStep(1)}
              >
                Edit
              </button>
            </div>
          </section>

          {/* Guest Details Form */}
          <form onSubmit={handleSubmit} noValidate autoComplete="off">
            <section className={styles.card}>
              <div className={styles.cardTopRow}>
                <h3 className={styles.cardHeading}>Guest details</h3>
                {(visitorName || visitorEmail || visitorPhone) && (
                  <button
                    type="button"
                    className={styles.editBtn}
                    onClick={() => {
                      setVisitorName("");
                      setVisitorEmail("");
                      setVisitorPhone("");
                      setErrors({});
                    }}
                  >
                    Clear fields
                  </button>
                )}
              </div>

              <div className={styles.honeypot} aria-hidden="true">
                <label htmlFor="website">Leave this field empty</label>
                <input
                  id="website"
                  name="website"
                  type="text"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  tabIndex={-1}
                  autoComplete="off"
                />
              </div>

              <div className={styles.fieldGroup}>
                <label htmlFor="visitorName">Full name</label>
                <input
                  id="visitorName"
                  name="visitorName"
                  type="text"
                  autoComplete="off"
                  placeholder="Juan dela Cruz"
                  value={visitorName}
                  onChange={(e) => setVisitorName(e.target.value)}
                  required
                  maxLength={120}
                />
                {fieldError("visitorName")}
              </div>

              <div className={styles.fieldGroup}>
                <label htmlFor="visitorEmail">Email address</label>
                <input
                  id="visitorEmail"
                  name="visitorEmail"
                  type="email"
                  autoComplete="off"
                  placeholder="juan@example.com"
                  value={visitorEmail}
                  onChange={(e) => setVisitorEmail(e.target.value)}
                  required
                  maxLength={254}
                />
                {fieldError("visitorEmail")}
              </div>

              <div className={styles.fieldGroup}>
                <label htmlFor="visitorPhone">Phone number</label>
                <input
                  id="visitorPhone"
                  name="visitorPhone"
                  type="tel"
                  autoComplete="off"
                  placeholder="+63 917 123 4567"
                  value={visitorPhone}
                  onChange={(e) => setVisitorPhone(e.target.value)}
                  required
                  maxLength={32}
                />
                {fieldError("visitorPhone")}
              </div>
            </section>

            <div className={styles.infoNote}>
              Your reservation starts as <strong>Pending Review</strong>. No
              payment is collected online—your QR entry pass will be emailed as
              soon as the farm administrator confirms your slot.
            </div>

            <button
              type="submit"
              className={styles.primaryCta}
              disabled={submitting}
            >
              {submitting ? "Submitting request…" : "Request reservation →"}
            </button>
          </form>
        </div>
      )}

      {/* STEP 3: CONFIRMATION / PENDING PASS */}
      {step === 3 && notice && (
        <div className={styles.stepContainer}>
          <header className={`${styles.stepHeader} ${styles.centerHeader}`}>
            <span className={styles.statusPill}>
              {notice.kind === "submitted"
                ? "Request Submitted"
                : "Saved • Email Pending"}
            </span>
            <h1>See you at the farm!</h1>
            <p>
              {notice.kind === "submitted"
                ? "Your visit request is with the farm administrator. Watch your inbox for your official QR ticket."
                : "Your request was saved, though the notification email could not be sent automatically. Keep your reference below."}
            </p>
          </header>

          <section className={styles.ticketCard}>
            <div className={styles.ticketBanner}>
              <div>
                <span className={styles.ticketEyebrow}>SAGANA VISIT PASS</span>
                <h2>{selectedFarm?.name}</h2>
                <p>{selectedFarm?.location}</p>
              </div>
              <span className={styles.ticketBadge}>PENDING APPROVAL</span>
            </div>

            <div className={styles.ticketBody}>
              <div className={styles.ticketDetails}>
                <div className={styles.ticketRow}>
                  <span>Reference ID</span>
                  <strong>{notice.reference}</strong>
                </div>
                <div className={styles.ticketRow}>
                  <span>Visitor</span>
                  <strong>{visitorName}</strong>
                </div>
                <div className={styles.ticketRow}>
                  <span>Visit Date</span>
                  <strong>{formatReadableDate(visitDate)}</strong>
                </div>
                <div className={styles.ticketRow}>
                  <span>Time Slot</span>
                  <strong>{selectedSlot?.label}</strong>
                </div>
                <div className={styles.ticketRow}>
                  <span>Guests</span>
                  <strong>
                    {totalGuests} ({adults} {adults === 1 ? "Adult" : "Adults"}
                    {children > 0
                      ? `, ${children} ${children === 1 ? "Child" : "Children"}`
                      : ""}
                    )
                  </strong>
                </div>
              </div>

              <div className={styles.ticketQrBox}>
                <div className={styles.qrPlaceholder} aria-hidden="true">
                  <span>QR</span>
                </div>
                <p>
                  Your unique check-in QR code will be sent to{" "}
                  <strong>{visitorEmail}</strong> once approved.
                </p>
              </div>
            </div>
          </section>

          <div
            className={styles.confirmationActions}
            style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}
          >
            <button
              type="button"
              className={styles.primaryCta}
              onClick={resetForm}
            >
              Book another reservation
            </button>
            <Link
              href="/"
              className={styles.secondaryButton}
              style={{
                display: "block",
                textAlign: "center",
                padding: "0.9rem 1.25rem",
                borderRadius: "0.75rem",
                textDecoration: "none",
                fontWeight: 600,
              }}
            >
              Back to home
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}