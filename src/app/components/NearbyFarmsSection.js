"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import FarmThumbnail from "./FarmThumbnail";
import "./nearby-farms.css";
import ScrollRow from "./ScrollRow";

function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(km) {
  return km < 1 ? `${Math.round(km * 1000)} m away` : `${km.toFixed(1)} km away`;
}

export default function NearbyFarmsSection({ farms, radiusKm = 20 }) {
  const [coords, setCoords] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | locating | ready | denied | unsupported

  function requestLocation() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("unsupported");
      return;
    }

    setStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setStatus("ready");
      },
      () => setStatus("denied"),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  }

  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.permissions?.query) {
      navigator.permissions
        .query({ name: "geolocation" })
        .then((result) => {
          if (result.state === "granted") requestLocation();
        })
        .catch(() => {});
    }
  }, []);

  const nearbyFarms = coords
    ? farms
        .filter((farm) => farm.latitude != null && farm.longitude != null)
        .map((farm) => ({
          ...farm,
          distanceKm: calculateDistanceKm(
            coords.lat,
            coords.lng,
            Number(farm.latitude),
            Number(farm.longitude),
          ),
        }))
        .filter((farm) => !Number.isNaN(farm.distanceKm) && farm.distanceKm <= radiusKm)
        .sort((a, b) => a.distanceKm - b.distanceKm)
    : [];

  return (
    <section className="nearby-section" aria-labelledby="nearby-farms-heading">
      <div className="nearby-header">
        <h2 id="nearby-farms-heading">Nearby Farms</h2>

          <button
            type="button"
            className="nearby-btn"
            onClick={requestLocation}
            disabled={status === "locating"}
          >
            {status === "locating" ? "Finding nearby farms..." : "Use my location"}
          </button>
      </div>

      {status === "idle" && (
        <p className="nearby-note">
          Enable location access to see fruit farms closest to you (within {radiusKm} km).
        </p>
      )}

      {status === "denied" && (
        <p className="nearby-note error">
          Location permission was declined. Allow location access in your browser
          settings and click &ldquo;Use my location&rdquo; to view nearby farms.
        </p>
      )}

      {status === "unsupported" && (
        <p className="nearby-note">Your browser does not support geolocation.</p>
      )}

      {status === "ready" && nearbyFarms.length === 0 && (
        <p className="nearby-note">
          No farms found within {radiusKm} km of your current location.
        </p>
      )}

      {status === "ready" && nearbyFarms.length > 0 && (
        <ScrollRow className="nearby-row">
          {nearbyFarms.map((farm) => (
            <article className="nearby-card" key={farm.id}>
              <Link href={`/farms/${encodeURIComponent(String(farm.id))}`}>
                <div className="nearby-media">
                  <FarmThumbnail
                    farm={farm}
                    sizes="(max-width: 40rem) 100vw, (max-width: 70rem) 33vw, 25vw"
                  />
                </div>
                <div className="nearby-info">
                  <span className="nearby-distance">{formatDistance(farm.distanceKm)}</span>
                  <h3>{farm.name}</h3>
                  <p>{farm.location || "Location not provided"}</p>
                  <p>{farm.province || "Province not provided"}</p>
                </div>
              </Link>
            </article>
          ))}
        </ScrollRow>
      )}
    </section>
  );
}