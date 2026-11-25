"use client";

import { useState } from "react";
import Link from "next/link";

const EMPTY_FORM = {
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
  video_url: "",
  website: "", 
};

export default function FarmRegisterForm() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [submitted, setSubmitted] = useState(null); 
  const [submitting, setSubmitting] = useState(false);

  const set = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const fieldError = (name) =>
    errors[name] ? (
      <span className="field-error" role="alert">
        {errors[name]}
      </span>
    ) : null;

  async function handleSubmit(event) {
    event.preventDefault();
    setErrors({});
    setFormError("");

    const cropsList = form.crops.split(",").map((c) => c.trim()).filter(Boolean);
    if (
      !form.farm_name.trim() ||
      !form.province.trim() ||
      !form.location.trim() ||
      !form.admin_email.trim() ||
      cropsList.length === 0
    ) {
      setFormError("Please fill out all required fields.");
      return;
    }

    if (form.video_url.trim() && !/^https?:\/\/.+/i.test(form.video_url.trim())) {
      setErrors({ video_url: "The video link must start with https://" });
      setFormError("Please check the video link.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/farms/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = await response.json();

      if (result.saved) {
        setSubmitted({ name: form.farm_name, email: form.admin_email });
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        setErrors(result.errors ?? {});
        setFormError(
          result.error ?? "Please check the highlighted fields below."
        );
      }
    } catch {
      setFormError("Could not connect to the server. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function registerAnother() {
    setForm(EMPTY_FORM);
    setErrors({});
    setFormError("");
    setSubmitted(null);
  }

  if (submitted) {
    return (
      <section className="submission-banner" role="status" aria-live="polite">
        <span className="banner-icon" aria-hidden="true">✓</span>
        <div className="banner-body">
          <h2>Your farm listing has been submitted</h2>
          <p>
            <strong>{submitted.name}</strong> is now being processed by our
            admin team. We&apos;ll review the details and email you at{" "}
            <strong>{submitted.email}</strong> once it&apos;s approved.
          </p>
          <p className="banner-status">
            <span className="status-dot" /> Status: Pending admin review
          </p>
          <div className="banner-actions">
            <Link href="/farm" className="banner-link primary">
              Browse farms
            </Link>
            <button type="button" className="banner-link" onClick={registerAnother}>
              Register another farm
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <form
      id="farm-registration-form"
      className="registration-card"
      onSubmit={handleSubmit}
      noValidate
    >
      <div className="honeypot" aria-hidden="true">
        <label htmlFor="website">Leave this field empty</label>
        <input
          id="website"
          name="website"
          type="text"
          value={form.website}
          onChange={set("website")}
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      {/* Section 1 */}
      <fieldset className="form-fieldset">
        <legend className="form-legend">
          <span>Farm &amp; Owner Details</span>
          <span className="legend-note">* Required fields</span>
        </legend>

        <div className="form-grid">
          <p className="form-field">
            <label htmlFor="reg-farm-name">Farm Name *</label>
            <input type="text" id="reg-farm-name" name="farm_name" required
              placeholder="e.g. Batangas Mango Orchard"
              value={form.farm_name} onChange={set("farm_name")} />
            {fieldError("farm_name")}
          </p>
          <p className="form-field">
            <label htmlFor="reg-province">Province / Region *</label>
            <input type="text" id="reg-province" name="province" required
              placeholder="e.g. Batangas"
              value={form.province} onChange={set("province")} />
            {fieldError("province")}
          </p>
          <p className="form-field">
            <label htmlFor="reg-location">Complete Address (Barangay, City) *</label>
            <input type="text" id="reg-location" name="location" required
              placeholder="e.g. Brgy. Sambat, Tanauan City, Batangas"
              value={form.location} onChange={set("location")} />
            {fieldError("location")}
          </p>
          <p className="form-field">
            <label htmlFor="reg-admin-email">Admin Email (for booking alerts) *</label>
            <input type="email" id="reg-admin-email" name="admin_email" required
              placeholder="owner@farm.com"
              value={form.admin_email} onChange={set("admin_email")} />
            {fieldError("admin_email")}
          </p>
          <p className="form-field">
            <label htmlFor="reg-entrance-fee">Entrance Fee (PHP per person)</label>
            <input type="number" id="reg-entrance-fee" name="entrance_fee" min="0"
              placeholder="e.g. 100"
              value={form.entrance_fee} onChange={set("entrance_fee")} />
            {fieldError("entrance_fee")}
          </p>
        </div>
      </fieldset>

      {/* Section 2 */}
      <fieldset className="form-fieldset">
        <legend className="form-legend">
          <span>Harvest &amp; Operations</span>
        </legend>

        <div className="form-grid">
          <p className="form-field">
            <label htmlFor="reg-crops">Crops Grown (comma-separated) *</label>
            <input type="text" id="reg-crops" name="crops" required
              placeholder="Mango, Pineapple, Rambutan"
              value={form.crops} onChange={set("crops")} />
            {fieldError("crops")}
          </p>
          <p className="form-field">
            <label htmlFor="reg-season">Primary Season *</label>
            <select id="reg-season" name="season" required className="form-select"
              value={form.season} onChange={set("season")}>
              <option value="dry">Dry Season (Dec - May)</option>
              <option value="wet">Wet Season (Jun - Nov)</option>
              <option value="all">All Year Round</option>
            </select>
          </p>
          <p className="form-field">
            <label htmlFor="reg-bearing-season">Peak Bearing Months</label>
            <input type="text" id="reg-bearing-season" name="bearing_season"
              placeholder="e.g. March to June"
              value={form.bearing_season} onChange={set("bearing_season")} />
          </p>
          <p className="form-field">
            <label htmlFor="reg-hours">Operating Hours</label>
            <input type="text" id="reg-hours" name="hours"
              placeholder="e.g. Mon - Sun: 8:00 AM - 5:00 PM"
              value={form.hours} onChange={set("hours")} />
          </p>
          <p className="form-field full-width">
            <label htmlFor="reg-description">Farm Description &amp; Activities</label>
            <textarea id="reg-description" name="description" rows={4}
              placeholder="Tell visitors what makes your farm special (e.g. fruit picking tours, organic products)..."
              value={form.description} onChange={set("description")} />
          </p>
        </div>
      </fieldset>

      {/* Section 3 */}
      <fieldset className="form-fieldset">
        <legend className="form-legend">
          <span>Map Location &amp; Media</span>
        </legend>

        <div className="form-grid">
          <p className="form-field">
            <label htmlFor="reg-lat">Latitude (for Map Pin)</label>
            <input type="number" step="any" id="reg-lat" name="latitude"
              placeholder="e.g. 13.7565"
              value={form.latitude} onChange={set("latitude")} />
            {fieldError("latitude")}
          </p>
          <p className="form-field">
            <label htmlFor="reg-lng">Longitude (for Map Pin)</label>
            <input type="number" step="any" id="reg-lng" name="longitude"
              placeholder="e.g. 121.0583"
              value={form.longitude} onChange={set("longitude")} />
            {fieldError("longitude")}
          </p>
          <p className="form-field">
            <label htmlFor="reg-image-url">Main Cover Photo (URL)</label>
            <input type="url" id="reg-image-url" name="image_url"
              placeholder="https://example.com/farm-photo.jpg"
              value={form.image_url} onChange={set("image_url")} />
            {fieldError("image_url")}
          </p>
          <p className="form-field">
            <label htmlFor="reg-video-url">Farm Video Walkthrough (URL)</label>
            <input type="url" id="reg-video-url" name="video_url"
              placeholder="https://example.com/farm-video.mp4 (optional)"
              value={form.video_url} onChange={set("video_url")} />
            {fieldError("video_url")}
          </p>
        </div>
      </fieldset>

      {formError && (
        <p id="form-error" className="form-error" role="alert">
          {formError}
        </p>
      )}

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" id="submit-btn" disabled={submitting}>
          {submitting ? "Submitting..." : "Submit Farm Listing"}
        </button>
      </div>
    </form>
  );
}