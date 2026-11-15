"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import FarmThumbnail from "./FarmThumbnail";
import styles from "../farm/farm-listing.module.css";

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

export default function NearbyFarmsSection({ farms, radiusKm = 100 }) {
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
        () => {
            setStatus("denied");
        },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
        );
    }

    useEffect(() => {
        if (typeof navigator !== "undefined" && navigator.permissions?.query) {
        navigator.permissions
            .query({ name: "geolocation" })
            .then((result) => {
            if (result.state === "granted") {
                requestLocation();
            }
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
        <section className={styles.section} aria-labelledby="nearby-farms-heading">
        <div
            style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "0.75rem",
            marginBottom: "1rem",
            }}
        >
            <h2 id="nearby-farms-heading" className={styles.sectionTitle} style={{ margin: 0 }}>
            Nearby Farms
            </h2>

            {status !== "ready" && (
            <button
                type="button"
                onClick={requestLocation}
                disabled={status === "locating"}
                style={{
                padding: "0.55rem 1rem",
                borderRadius: "999px",
                border: "none",
                background: "#173d2b",
                color: "#ffffff",
                fontSize: "0.88rem",
                fontWeight: 650,
                cursor: status === "locating" ? "wait" : "pointer",
                }}
            >
                {status === "locating" ? "Finding nearby farms..." : "Use my location"}
            </button>
            )}
        </div>

        {status === "idle" && (
            <p style={{ color: "#4a5a4e", fontSize: "0.95rem" }}>
            Enable location access to see fruit farms closest to you (within {radiusKm} km).
            </p>
        )}

        {status === "denied" && (
            <p style={{ color: "#8a2c2c", fontSize: "0.92rem" }}>
            Location permission was declined. Allow location access in your browser settings and click &ldquo;Use my location&rdquo; to view nearby farms.
            </p>
        )}

        {status === "unsupported" && (
            <p style={{ color: "#4a5a4e", fontSize: "0.92rem" }}>
            Your browser does not support geolocation.
            </p>
        )}

        {status === "ready" && nearbyFarms.length === 0 && (
            <p style={{ color: "#4a5a4e", fontSize: "0.95rem" }}>
            No farms found within {radiusKm} km of your current location.
            </p>
        )}

        {status === "ready" && nearbyFarms.length > 0 && (
            <div className={styles.grid}>
            {nearbyFarms.map((farm) => (
                <article className={styles.card} key={farm.id}>
                <Link
                    className={styles.cardLink}
                    href={`/farms/${encodeURIComponent(String(farm.id))}`}
                >
                    <div className={styles.thumbnail}>
                    <FarmThumbnail
                        className={styles.image}
                        farm={farm}
                        sizes="(max-width: 40rem) 100vw, (max-width: 70rem) 50vw, 33vw"
                    />
                    </div>
                    <div className={styles.cardContent}>
                    <span
                        style={{
                        display: "inline-block",
                        marginBottom: "0.35rem",
                        padding: "0.2rem 0.6rem",
                        borderRadius: "999px",
                        background: "#e8f2e4",
                        color: "#173d2b",
                        fontSize: "0.78rem",
                        fontWeight: 700,
                        }}
                    >
                        {formatDistance(farm.distanceKm)}
                    </span>
                    <h3>{farm.name}</h3>
                    <p>{farm.location || "Location not provided"}</p>
                    <p>{farm.province || "Province not provided"}</p>
                    </div>
                </Link>
                </article>
            ))}
            </div>
        )}
        </section>
    );
}