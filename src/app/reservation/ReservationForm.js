"use client";

import { useState } from "react";
import styles from "./reservation.module.css";

export default function ReservationForm({ farms, initialFarmId, minDate }) {
  const [farmId, setFarmId] = useState(
    farms.some((farm) => farm.id === initialFarmId)
      ? initialFarmId
      : farms[0]?.id ?? "",
  );
  const [timeSlotId, setTimeSlotId] = useState("");
  const [errors, setErrors] = useState({});
  const [notice, setNotice] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const selectedFarm = farms.find((farm) => farm.id === farmId);
  const timeSlots = selectedFarm?.timeSlots ?? [];

  async function handleSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    setErrors({});
    setNotice(null);
    setSubmitting(true);

    const formData = new FormData(form);
    const payload = {
      visitorName: formData.get("visitorName"),
      visitorEmail: formData.get("visitorEmail"),
      visitorPhone: formData.get("visitorPhone"),
      farmId: formData.get("farmId"),
      timeSlotId: formData.get("timeSlotId"),
      guestCount: Number(formData.get("guestCount")),
      visitDate: formData.get("visitDate"),
      website: formData.get("website"),
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
        if (result.notificationSent) {
          form.reset();
          setFarmId(farms[0]?.id ?? "");
          setTimeSlotId("");
        }
      } else {
        setErrors(result.errors ?? {});
        setNotice({
          kind: "failed",
          message: result.error ?? "Your request could not be submitted.",
        });
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

  return (
    <div>
      {notice?.kind === "submitted" && (
        <section className={styles.notice} role="status">
          Your request was saved for administrator review. Reference:{" "}
          <strong>{notice.reference}</strong>. You will receive an email after a
          decision is made.
        </section>
      )}
      {notice?.kind === "saved-not-notified" && (
        <section className={`${styles.notice} ${styles.error}`} role="alert">
          Your request was saved, but the farm could not be notified by email.
          Reference: <strong>{notice.reference}</strong>. Please do not submit
          again; contact the farm with this reference.
        </section>
      )}
      {notice?.kind === "failed" && (
        <section className={`${styles.notice} ${styles.error}`} role="alert">
          {notice.message}
        </section>
      )}

      {farms.length === 0 ? (
        <section className={styles.notice}>
          There are no farms currently accepting visit requests.
        </section>
      ) : (
        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <div className={styles.honeypot} aria-hidden="true">
            <label htmlFor="website">Leave this field empty</label>
            <input
              id="website"
              name="website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="visitorName">Visitor name</label>
            <input id="visitorName" name="visitorName" required maxLength={120} />
            {fieldError("visitorName")}
          </div>
          <div className={styles.field}>
            <label htmlFor="visitorEmail">Email address</label>
            <input
              id="visitorEmail"
              name="visitorEmail"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
            />
            {fieldError("visitorEmail")}
          </div>
          <div className={styles.field}>
            <label htmlFor="visitorPhone">Phone number</label>
            <input
              id="visitorPhone"
              name="visitorPhone"
              type="tel"
              autoComplete="tel"
              required
              maxLength={32}
            />
            {fieldError("visitorPhone")}
          </div>
          <div className={styles.field}>
            <label htmlFor="farmId">Farm</label>
            <select
              id="farmId"
              name="farmId"
              value={farmId}
              onChange={(event) => {
                setFarmId(event.target.value);
                setTimeSlotId("");
              }}
            >
              {farms.map((farm) => (
                <option key={farm.id} value={farm.id}>
                  {farm.name}
                </option>
              ))}
            </select>
            {fieldError("farmId")}
          </div>
          <div className={styles.field}>
            <label htmlFor="timeSlotId">Visit time</label>
            <select
              id="timeSlotId"
              name="timeSlotId"
              value={timeSlotId}
              onChange={(event) => setTimeSlotId(event.target.value)}
              required
              disabled={timeSlots.length === 0}
            >
              <option value="">Choose a time</option>
              {timeSlots.map((slot) => (
                <option key={slot.id} value={slot.id}>
                  {slot.label}
                </option>
              ))}
            </select>
            {fieldError("timeSlotId")}
          </div>
          <div className={styles.field}>
            <label htmlFor="visitDate">Visit date (Philippine time)</label>
            <input
              id="visitDate"
              name="visitDate"
              type="date"
              min={minDate}
              required
            />
            {fieldError("visitDate")}
          </div>
          <div className={styles.field}>
            <label htmlFor="guestCount">Number of guests</label>
            <input
              id="guestCount"
              name="guestCount"
              type="number"
              min={1}
              max={selectedFarm?.maxPartySize ?? undefined}
              required
            />
            {fieldError("guestCount")}
          </div>
          <button
            className={styles.button}
            type="submit"
            disabled={submitting || timeSlots.length === 0}
          >
            {submitting ? "Sending request…" : "Request a farm visit"}
          </button>
        </form>
      )}
    </div>
  );
}
