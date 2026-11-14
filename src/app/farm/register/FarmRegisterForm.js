"use client";

import { useState } from "react";
import Link from "next/link";
import styles from "../../reservation/reservation.module.css";

export default function FarmRegisterForm() {
    const [form, setForm] = useState({
        farm_name: "",
        province: "",
        location: "",
        admin_email: "",
        entrance_fee: "",
        crops: "",
        season: "dry",
        bearing_season: "",
        hours: "",
        description: "",
        latitude: "",
        longitude: "",
        image_url: "",
        website: "",
    });

    const [errors, setErrors] = useState({});
    const [statusNotice, setStatusNotice] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    function updateField(field, value) {
        setForm((prev) => ({ ...prev, [field]: value }));
    }

    async function handleSubmit(event) {
        event.preventDefault();
        setErrors({});
        setStatusNotice(null);
        setSubmitting(true);

        try {
        const response = await fetch("/api/farms/register", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(form),
        });
        const result = await response.json();

        if (result.saved) {
            setStatusNotice({
            kind: "success",
            farmId: result.farmId,
            });
            window.scrollTo({ top: 0, behavior: "smooth" });
        } else {
            setErrors(result.errors ?? {});
            setStatusNotice({
            kind: "error",
            message: result.error ?? "Please check the highlighted fields below.",
            });
        }
        } catch {
        setStatusNotice({
            kind: "error",
            message: "Could not connect to the server. Please try again.",
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

    if (statusNotice?.kind === "success") {
        return (
        <div className={styles.wrapper}>
            <header className={`${styles.stepHeader} ${styles.centerHeader}`}>
            <span className={styles.statusPill}>Application Received</span>
            <h1>Thank you for registering your farm!</h1>
            <p>
                Our team will review <strong>{form.farm_name}</strong> and activate
                your public listing shortly.
            </p>
            </header>

            <section className={styles.card}>
            <div className={styles.ticketDetails}>
                <div className={styles.ticketRow}>
                <span>Farm Name</span>
                <strong>{form.farm_name}</strong>
                </div>
                <div className={styles.ticketRow}>
                <span>Location</span>
                <strong>
                    {form.location} ({form.province})
                </strong>
                </div>
                <div className={styles.ticketRow}>
                <span>Booking Alert Email</span>
                <strong>{form.admin_email}</strong>
                </div>
                <div className={styles.ticketRow}>
                <span>Crops</span>
                <strong>{form.crops}</strong>
                </div>
            </div>
            </section>

            <Link href="/" className={styles.primaryCta}>
            Back to Home
            </Link>
        </div>
        );
    }

    return (
        <div className={styles.wrapper}>
        <header className={styles.stepHeader}>
            <h1>Register Your Farm on SAGANA</h1>
            <p>
            Fill out the details below to feature your agritourism destination on
            our platform.
            </p>
        </header>

        {statusNotice?.kind === "error" && (
            <div className={`${styles.notice} ${styles.error}`} role="alert">
            {statusNotice.message}
            </div>
        )}

        <form
            className={styles.stepContainer}
            onSubmit={handleSubmit}
            noValidate
        >
            <div className={styles.honeypot} aria-hidden="true">
            <label htmlFor="website">Leave this field empty</label>
            <input
                id="website"
                name="website"
                type="text"
                value={form.website}
                onChange={(e) => updateField("website", e.target.value)}
                tabIndex={-1}
                autoComplete="off"
            />
            </div>

            {/* Section 1: Farm & Owner Details */}
            <section className={styles.card}>
            <h2 className={styles.cardHeading}>Farm &amp; Owner Details</h2>

            <div className={styles.fieldGroup}>
                <label htmlFor="reg-farm-name">Farm Name *</label>
                <input
                id="reg-farm-name"
                type="text"
                required
                placeholder="e.g. Batangas Mango Orchard"
                value={form.farm_name}
                onChange={(e) => updateField("farm_name", e.target.value)}
                />
                {fieldError("farm_name")}
            </div>

            <div className={styles.fieldGroup}>
                <label htmlFor="reg-province">Province / Region *</label>
                <input
                id="reg-province"
                type="text"
                required
                placeholder="e.g. Batangas"
                value={form.province}
                onChange={(e) => updateField("province", e.target.value)}
                />
                {fieldError("province")}
            </div>

            <div className={styles.fieldGroup}>
                <label htmlFor="reg-location">
                Complete Address (Barangay, City) *
                </label>
                <input
                id="reg-location"
                type="text"
                required
                placeholder="e.g. Brgy. Sambat, Tanauan City, Batangas"
                value={form.location}
                onChange={(e) => updateField("location", e.target.value)}
                />
                {fieldError("location")}
            </div>

            <div className={styles.fieldGroup}>
                <label htmlFor="reg-admin-email">
                Admin Email (for booking alerts) *
                </label>
                <input
                id="reg-admin-email"
                type="email"
                required
                placeholder="owner@farm.com"
                value={form.admin_email}
                onChange={(e) => updateField("admin_email", e.target.value)}
                />
                {fieldError("admin_email")}
            </div>

            <div className={styles.fieldGroup}>
                <label htmlFor="reg-entrance-fee">
                Entrance Fee (PHP per person)
                </label>
                <input
                id="reg-entrance-fee"
                type="text"
                placeholder="e.g. ₱100 or Free"
                value={form.entrance_fee}
                onChange={(e) => updateField("entrance_fee", e.target.value)}
                />
            </div>
            </section>

            {/* Section 2: Harvest & Operations */}
            <section className={styles.card}>
            <h2 className={styles.cardHeading}>Harvest &amp; Operations</h2>

            <div className={styles.fieldGroup}>
                <label htmlFor="reg-crops">
                Crops Grown (comma-separated) *
                </label>
                <input
                id="reg-crops"
                type="text"
                required
                placeholder="Mango, Pineapple, Rambutan"
                value={form.crops}
                onChange={(e) => updateField("crops", e.target.value)}
                />
                {fieldError("crops")}
            </div>

            <div className={styles.fieldGroup}>
                <label htmlFor="reg-season">Primary Season *</label>
                <select
                id="reg-season"
                value={form.season}
                onChange={(e) => updateField("season", e.target.value)}
                style={{
                    padding: "0.75rem 0.9rem",
                    border: "1px solid #c8d5c8",
                    borderRadius: "0.65rem",
                    background: "#ffffff",
                    color: "#1f2e23",
                    fontSize: "0.95rem",
                }}
                >
                <option value="dry">Dry Season (Dec - May)</option>
                <option value="wet">Wet Season (Jun - Nov)</option>
                <option value="all">All Year Round</option>
                </select>
            </div>

            <div className={styles.fieldGroup}>
                <label htmlFor="reg-bearing-season">Peak Bearing Months</label>
                <input
                id="reg-bearing-season"
                type="text"
                placeholder="e.g. March to June"
                value={form.bearing_season}
                onChange={(e) => updateField("bearing_season", e.target.value)}
                />
            </div>

            <div className={styles.fieldGroup}>
                <label htmlFor="reg-hours">Operating Hours</label>
                <input
                id="reg-hours"
                type="text"
                placeholder="e.g. Mon - Sun: 8:00 AM - 5:00 PM"
                value={form.hours}
                onChange={(e) => updateField("hours", e.target.value)}
                />
            </div>

            <div className={styles.fieldGroup}>
                <label htmlFor="reg-description">
                Farm Description &amp; Activities
                </label>
                <textarea
                id="reg-description"
                rows={4}
                placeholder="Tell visitors what makes your farm special (e.g. fruit picking tours, organic products)..."
                value={form.description}
                onChange={(e) => updateField("description", e.target.value)}
                style={{
                    padding: "0.75rem 0.9rem",
                    border: "1px solid #c8d5c8",
                    borderRadius: "0.65rem",
                    background: "#ffffff",
                    color: "#1f2e23",
                    fontSize: "0.95rem",
                    fontFamily: "inherit",
                }}
                />
            </div>
            </section>

            {/* Section 3: Map Location & Media */}
            <section className={styles.card}>
            <h2 className={styles.cardHeading}>Map Location &amp; Media</h2>

            <div className={styles.fieldGroup}>
                <label htmlFor="reg-lat">Latitude (for Map Pin)</label>
                <input
                id="reg-lat"
                type="number"
                step="any"
                placeholder="e.g. 13.7565"
                value={form.latitude}
                onChange={(e) => updateField("latitude", e.target.value)}
                />
                {fieldError("latitude")}
            </div>

            <div className={styles.fieldGroup}>
                <label htmlFor="reg-lng">Longitude (for Map Pin)</label>
                <input
                id="reg-lng"
                type="number"
                step="any"
                placeholder="e.g. 121.0583"
                value={form.longitude}
                onChange={(e) => updateField("longitude", e.target.value)}
                />
                {fieldError("longitude")}
            </div>

            <div className={styles.fieldGroup}>
                <label htmlFor="reg-image-url">Main Cover Photo (URL)</label>
                <input
                id="reg-image-url"
                type="url"
                placeholder="https://example.com/farm-photo.jpg"
                value={form.image_url}
                onChange={(e) => updateField("image_url", e.target.value)}
                />
            </div>
            </section>

            <button
            type="submit"
            className={styles.primaryCta}
            disabled={submitting}
            >
            {submitting ? "Submitting Farm Listing…" : "Submit Farm Listing →"}
            </button>
        </form>
        </div>
    );
}