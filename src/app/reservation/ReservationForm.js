"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import styles from "./reservation.module.css";

const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const STEP_LABELS = ["Visit details", "Guest & waiver", "Digital ticket"];

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
      {/* Progress card */}
      <section className={styles.progressCard} aria-label="Reservation progress">
        <div className={styles.progressTop}>
          {step === 2 ? (
            <button
              type="button"
              className={styles.progressBack}
              onClick={() => setStep(1)}
              aria-label="Back to date and time"
            >
              &larr;
            </button>
          ) : (
            <Link
              href="/farm"
              className={styles.progressBack}
              aria-label="Back to farms"
            >
              &larr;
            </Link>
          )}
          <span className={styles.progressTitle}>Reservation</span>
          <span className={styles.guestBadge}>GUEST</span>
        </div>

        <ol className={styles.progressBars}>
          {STEP_LABELS.map((label, i) => {
            const n = i + 1;
            const done = step > n;
            return (
              <li
                key={label}
                className={`${styles.progressItem} ${
                  step >= n ? styles.progressActive : ""
                }`}
                aria-current={step === n ? "step" : undefined}
              >
                <span className={styles.progressBar} />
                <span className={styles.progressLabel}>
                  {done ? "✓ " : `${n}. `}
                  {label}
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      {/* STEP 1: PLAN YOUR FARM DAY */}
      {step === 1 && (
        <div className={styles.stepContainer}>
          <header className={styles.stepHeader}>
            <span className={styles.stepEyebrow}>Step 1 of 3</span>
            <h1>Plan your farm day</h1>
            <p>
              A little fresh air, a day to look forward to. Start with your
              visit details.
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
            Continue
          </button>
        </div>
      )}

      {/* STEP 2: PERSONAL DETAILS */}
      {step === 2 && (
        <div className={styles.stepContainer}>
          <header className={styles.stepHeader}>
            <span className={styles.stepEyebrow}>Step 2 of 3</span>
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
              {submitting ? "Submitting request…" : "Request reservation"}
            </button>
          </form>
        </div>
      )}

      {/* STEP 3: CONFIRMATION */}
      {step === 3 && notice && (
        <div className={styles.confirmWrap}>
          <header className={styles.confirmHeader}>
            <span className={styles.confirmPill}>
              ✓{" "}
              {notice.kind === "submitted"
                ? "Request Submitted"
                : "Saved • Email Pending"}
            </span>
            <h1>See you at the farm!</h1>
            <p>
              Your farm day is almost set,{" "}
              {visitorName.split(" ")[0] || "friend"}.
              <br />
              {notice.kind === "submitted"
                ? "Watch your inbox. Your QR ticket arrives once the farm approves."
                : "Your request was saved. Keep your reference below."}
            </p>
          </header>

          <section className={styles.ticketCard}>
            <div className={styles.ticketBanner}>
              <img
                src={selectedFarm?.imageUrl || "/farm-placeholder.svg"}
                alt=""
                className={styles.ticketThumb}
                onError={(e) => {
                  e.currentTarget.src = "/farm-placeholder.svg";
                }}
              />
              <div>
                <span className={styles.ticketEyebrow}>
                  FARM VISIT · GUEST TICKET
                </span>
                <h2>{selectedFarm?.name}</h2>
                <p>{selectedFarm?.location}</p>
              </div>
            </div>

            <div className={styles.ticketBody}>
              <div className={styles.ticketLeft}>
                <div className={styles.ticketLeftHead}>
                  <h3>Your visit</h3>
                  <span className={styles.ticketRef}>{notice.reference}</span>
                </div>

                <div className={styles.infoRow}>
                  <span className={styles.infoIcon} aria-hidden="true">📅</span>
                  <div>
                    <span className={styles.infoLabel}>Visit date</span>
                    <strong>{formatReadableDate(visitDate)}</strong>
                  </div>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.infoIcon} aria-hidden="true">🕒</span>
                  <div>
                    <span className={styles.infoLabel}>Time slot</span>
                    <strong>{selectedSlot?.label}</strong>
                  </div>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.infoIcon} aria-hidden="true">👥</span>
                  <div>
                    <span className={styles.infoLabel}>Visitors</span>
                    <strong>
                      {adults} {adults === 1 ? "adult" : "adults"}
                      {children > 0
                        ? ` · ${children} ${children === 1 ? "child" : "children"}`
                        : ""}
                    </strong>
                  </div>
                </div>

                <div className={styles.bookedFor}>
                  <span>Booked for</span>
                  <strong>{visitorName}</strong>
                </div>
              </div>

              <div className={styles.ticketRight}>
                <h3>Your gate check-in ticket</h3>
                <p>
                  Show this ticket to the farm team on arrival. They&apos;ll
                  scan your QR code at the gate.
                </p>
                <div className={styles.qrFrame} aria-hidden="true">
                  <div className={styles.qrGrid} />
                </div>
                <span className={styles.qrNote}>
                  QR ticket is emailed after approval
                </span>
              </div>
            </div>
          </section>

          <div className={styles.confirmFooter}>
            <div className={styles.emailBox}>
              <span aria-hidden="true">✉️</span>
              <div>
                <strong>Ticket emailed to you</strong>
                <span>{visitorEmail}</span>
              </div>
            </div>
            <div className={styles.confirmActions}>
              <Link href="/farm" className={styles.backFarmBtn}>
                Back to Farm &larr;
              </Link>
              <button
                type="button"
                className={styles.linkBtn}
                onClick={resetForm}
              >
                Book another reservation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}