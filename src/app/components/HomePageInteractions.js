"use client";

import ScrollRow from "./ScrollRow";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  buildContactMailto,
  getFarmImageUrl,
} from "@/lib/homepage.mjs";

function formatCrops(crops) {
  const values = Array.isArray(crops)
    ? crops
    : typeof crops === "string"
      ? [crops]
      : [];
  const labels = values
    .filter((crop) => typeof crop === "string" && crop.trim())
    .map((crop) => crop.trim());

  return labels.length > 0 ? labels.join(", ") : "Fresh Produce";
}

function handleImageError(event) {
  const image = event.currentTarget;
  if (image.dataset.fallbackUsed) {
    return;
  }

  image.dataset.fallbackUsed = "true";
  image.src = "/farm-placeholder.svg";
}

function FarmImage({ farm, sizes }) {
  return (
    <Image
      alt=""
      className="farm-image"
      fill
      onError={handleImageError}
      sizes={sizes}
      src={getFarmImageUrl(farm)}
      unoptimized
    />
  );
}

function createMapPopup(farm, latitude, longitude) {
  const popup = document.createElement("article");
  popup.className = "map-popup-card";

  const heading = document.createElement("h4");
  heading.textContent = farm.name || "Unnamed farm";

  const details = document.createElement("p");
  details.textContent = `Location: ${farm.location || farm.province || "Philippines"}; Crops: ${formatCrops(farm.crops)}`;

  const detailsLink = document.createElement("a");
  detailsLink.className = "btn-popup";
  detailsLink.href = `/farms/${encodeURIComponent(String(farm.id ?? ""))}`;
  detailsLink.textContent = "View farm details";

  const directionsLink = document.createElement("a");
  directionsLink.href = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
  directionsLink.rel = "noopener noreferrer";
  directionsLink.target = "_blank";
  directionsLink.textContent = "Get directions";

  popup.append(heading, details, detailsLink, document.createTextNode(" "), directionsLink);
  return popup;
}

export function FarmCarousel({ farms }) {
  const [activeIndex, setActiveIndex] = useState(0);

  function showSlide(offset) {
    setActiveIndex(
      (currentIndex) => (currentIndex + offset + farms.length) % farms.length,
    );
  }

  return (
    <div id="hero-carousel" className="carousel news-carousel">
      <div className="carousel-badge">SUGGESTED FOR YOU</div>
      <div
        id="news-carousel-track"
        className="carousel-track"
        aria-live="polite"
      >
        {farms.length === 0 ? (
          <p className="empty-state">Featured farm stories will appear here.</p>
        ) : (
          farms.map((farm, index) => (
            <article
              className={`slide news-slide${index === activeIndex ? " active" : ""}`}
              aria-hidden={index !== activeIndex}
              key={farm.id}
            >
              <div className="slide-media">
                <FarmImage farm={farm} sizes="(max-width: 768px) 100vw, 50vw" />
              </div>
              <div className="slide-caption news-caption">
                <span className="news-tag">
                  {farm.is_trending ? "Trending" : "Featured"}
                </span>
                <h3>
                  {farm.headline ||
                    `${farm.name || "This farm"} opens peak season tours`}
                </h3>
                <p className="summary-text">
                  {farm.news_summary || farm.description || "Discover a local farm experience."}
                </p>
                <div className="news-footer">
                  <span className="farm-source">
                    Source: <strong>{farm.name || "Sagana Farm"}</strong>
                  </span>
                  <Link
                    className="btn btn-sm btn-primary"
                    href={`/farms/${encodeURIComponent(String(farm.id))}`}
                  >
                    View farm details
                  </Link>
                </div>
              </div>
            </article>
          ))
        )}
      </div>
      <div className="carousel-nav-buttons">
        <button
          id="hero-prev"
          className="carousel-btn prev"
          type="button"
          aria-label="Previous headline"
          disabled={farms.length < 2}
          onClick={() => showSlide(-1)}
        >
          &larr;
        </button>
        <button
          id="hero-next"
          className="carousel-btn next"
          type="button"
          aria-label="Next headline"
          disabled={farms.length < 2}
          onClick={() => showSlide(1)}
        >
          &rarr;
        </button>
      </div>
    </div>
  );
}

export function PopularFarmGrid({ farms }) {
  if (farms.length === 0) {
    return <p className="empty-state">No farms are currently accepting visits.</p>;
  }

  return (
    <ScrollRow className="farm-row">
      {farms.map((farm) => (
        <article className="farm-card" key={farm.id}>
          <Link href={`/farms/${encodeURIComponent(String(farm.id))}`}>
            <div className="farm-card-media">
              <FarmImage farm={farm} sizes="(max-width: 768px) 100vw, 33vw" />
            </div>
            <div className="card-info">
              <h3>{farm.name}</h3>
              <p className="location">
                {farm.location || farm.province || "Philippines"}
              </p>
              <span className="tag">{formatCrops(farm.crops)}</span>
            </div>
          </Link>
        </article>
      ))}
    </ScrollRow>
  );
}

export function FarmMap({ farms }) {
  const mapElement = useRef(null);
  const [mapError, setMapError] = useState(false);

  useEffect(() => {
    let map;
    let cancelled = false;

    async function initializeMap() {
      const leafletModule = await import("leaflet");
      if (cancelled || !mapElement.current) {
        return;
      }

      const leaflet = leafletModule.default ?? leafletModule;
      map = leaflet.map(mapElement.current).setView([12.8797, 121.774], 6);
      leaflet
        .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 18,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        })
        .addTo(map);

      const farmIcon = leaflet.divIcon({
        className: "farm-map-marker-container",
        html: '<span class="farm-map-marker" aria-hidden="true">●</span>',
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      });
      const points = [];
      for (const farm of farms) {
        const latitude = Number(farm.latitude);
        const longitude = Number(farm.longitude);
        const point = [latitude, longitude];
        points.push(point);
        leaflet
          .marker(point, { icon: farmIcon, title: farm.name || "Farm location" })
          .addTo(map)
          .bindPopup(createMapPopup(farm, latitude, longitude));
      }

      if (points.length === 1) {
        map.setView(points[0], 10);
      } else if (points.length > 1) {
        map.fitBounds(points, { padding: [40, 40], maxZoom: 10 });
      }
    }

    initializeMap().catch((error) => {
      console.error("Could not initialize the farm map.", error);
      if (!cancelled) {
        setMapError(true);
      }
    });

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [farms]);

  return (
    <>
      {farms.length === 0 && (
        <p className="map-empty">
          Farm locations will appear here when farms add map coordinates.
        </p>
      )}
      {mapError && (
        <p className="map-error" role="status">
          The farm map could not be loaded. Please try again later.
        </p>
      )}
      <div
        id="leaflet-map"
        className="leaflet-map"
        ref={mapElement}
        role="region"
        aria-label="Map of active Sagana farms"
      />
    </>
  );
}

export function ContactForm() {
  const [notice, setNotice] = useState("");

  function handleSubmit(event) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const mailto = buildContactMailto({
      name: formData.get("name"),
      email: formData.get("email"),
      message: formData.get("message"),
    });

    setNotice("Opening your email application...");
    window.location.href = mailto;
  }

  return (
    <form
      id="general-contact-form"
      className="simple-form mt-2"
      onSubmit={handleSubmit}
    >
      <div className="form-group">
        <label htmlFor="contact-name">Your Name</label>
        <input
          id="contact-name"
          name="name"
          type="text"
          placeholder="Juan dela Cruz"
          required
        />
      </div>
      <div className="form-group">
        <label htmlFor="contact-email">Your Email</label>
        <input
          id="contact-email"
          name="email"
          type="email"
          placeholder="juan@example.com"
          required
        />
      </div>
      <div className="form-group">
        <label htmlFor="contact-msg">Message</label>
        <textarea
          id="contact-msg"
          name="message"
          rows="3"
          placeholder="How can we help you?"
          required
        />
      </div>
      <button type="submit" className="btn btn-primary">
        Send Message
      </button>
      <p className="form-notice" role="status" aria-live="polite">
        {notice}
      </p>
    </form>
  );
}