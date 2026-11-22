"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

function FarmReviewContent() {
    const searchParams = useSearchParams();
    const token = searchParams.get("token");

    const [farm, setFarm] = useState(null);
    const [loading, setLoading] = useState(Boolean(token));
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(token ? "" : "Missing review token in URL.");
    const [resultMessage, setResultMessage] = useState("");

    useEffect(() => {
        if (!token) return;

        fetch(`/api/farms/review?token=${encodeURIComponent(token)}`)
        .then((res) => res.json())
        .then((data) => {
            if (data.error) setError(data.error);
            else setFarm(data.farm);
        })
        .catch(() => setError("Failed to load farm details."))
        .finally(() => setLoading(false));
    }, [token]);

    async function handleDecision(decision) {
        setSubmitting(true);
        setError("");
        try {
        const res = await fetch("/api/farms/review", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token, decision }),
        });
        const data = await res.json();
        if (!res.ok) {
            setError(data.error || "Action failed.");
        } else {
            setResultMessage(
            decision === "approved"
                ? `${farm.name} has been approved and published! An email notification was sent to ${farm.admin_email}.`
                : `${farm.name} has been rejected. An update email was sent to ${farm.admin_email}.`,
            );
            setFarm({ ...farm, status: decision });
        }
        } catch {
        setError("Network error while submitting your decision.");
        } finally {
        setSubmitting(false);
        }
    }

    if (loading) {
        return <main style={{ padding: "48px 20px", textAlign: "center" }}>Loading farm submission...</main>;
    }

    return (
        <main style={{ maxWidth: "560px", margin: "48px auto", padding: "28px", background: "#fff", borderRadius: "16px", border: "1px solid #dfe6dc", fontFamily: "sans-serif" }}>
        <p style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", color: "#39744c", textTransform: "uppercase" }}>
            SAGANA ADMIN • FARM REVIEW
        </p>
        <h1 style={{ fontSize: "22px", color: "#173d2b", margin: "6px 0 16px" }}>
            Review Farm Registration
        </h1>

        {error && (
            <div style={{ padding: "12px 16px", background: "#fdecea", color: "#b71c1c", borderRadius: "8px", marginBottom: "16px" }}>
            {error}
            </div>
        )}

        {resultMessage && (
            <div style={{ padding: "14px 16px", background: "#e8f2e4", color: "#173d2b", borderRadius: "8px", marginBottom: "16px", fontWeight: 600 }}>
            {resultMessage}
            </div>
        )}

        {farm && (
            <>
            <div style={{ background: "#f8faf7", padding: "16px", borderRadius: "12px", border: "1px solid #e3ebe1", marginBottom: "20px", lineHeight: 1.7, fontSize: "14px" }}>
                <p style={{ margin: 0 }}><strong>Farm Name:</strong> {farm.name}</p>
                <p style={{ margin: 0 }}><strong>Province:</strong> {farm.province}</p>
                <p style={{ margin: 0 }}><strong>Address:</strong> {farm.location}</p>
                <p style={{ margin: 0 }}><strong>Owner Email:</strong> {farm.admin_email}</p>
                <p style={{ margin: 0 }}><strong>Crops:</strong> {Array.isArray(farm.crops) ? farm.crops.join(", ") : farm.crops}</p>
                <p style={{ margin: 0 }}><strong>Season:</strong> {farm.season}</p>
                {farm.video_url && (
                <p style={{ margin: 0 }}>
                    <strong>Video:</strong>{" "}
                    <a href={farm.video_url} target="_blank" rel="noreferrer" style={{ color: "#173d2b" }}>
                    Watch video
                    </a>
                </p>
                )}
                <p style={{ margin: 0 }}><strong>Current Status:</strong> {farm.status}</p>
            </div>

            {farm.status === "pending" && !resultMessage && (
                <div style={{ display: "flex", gap: "12px" }}>
                <button
                    type="button"
                    disabled={submitting}
                    onClick={() => handleDecision("approved")}
                    style={{ flex: 1, padding: "12px", background: "#173d2b", color: "#fff", border: "none", borderRadius: "10px", fontWeight: 700, cursor: "pointer" }}
                >
                    {submitting ? "Processing..." : "Approve & Publish Farm"}
                </button>
                <button
                    type="button"
                    disabled={submitting}
                    onClick={() => handleDecision("rejected")}
                    style={{ flex: 1, padding: "12px", background: "#fff", color: "#b71c1c", border: "1px solid #b71c1c", borderRadius: "10px", fontWeight: 700, cursor: "pointer" }}
                >
                    Reject
                </button>
                </div>
            )}
            </>
        )}
        </main>
    );
}

export default function FarmReviewPage() {
    return (
        <Suspense fallback={<p style={{ padding: "48px", textAlign: "center" }}>Loading...</p>}>
        <FarmReviewContent />
        </Suspense>
    );
}