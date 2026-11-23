"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getFarmChatReply } from "@/lib/homepage.mjs";

const MONTHS = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];

// "November to May" / "Nov - Apr" / "All year"  ->  12 on/off flags
function parseSeason(text) {
  const flags = new Array(12).fill(false);
  const s = String(text || "").toLowerCase();
  if (/year[\s-]*round|all year|whole year|yearly/.test(s)) return flags.fill(true);

  const found = [];
  const re = /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*/g;
  let m;
  while ((m = re.exec(s))) found.push(MONTHS.indexOf(m[1]));

  if (found.length === 2 && /\bto\b|-|–|until|through/.test(s)) {
    for (let i = found[0]; ; i = (i + 1) % 12) {
      flags[i] = true;
      if (i === found[1]) break;
    }
  } else {
    found.forEach((i) => (flags[i] = true));
  }
  return flags;
}

// Turns a YouTube link (watch, youtu.be, shorts, embed) into a privacy-friendly embed URL.
// Returns null for anything that is not a real YouTube video link.
function getYouTubeEmbedUrl(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, "").replace(/^m\./, "");
    let id = null;

    if (host === "youtu.be") {
      id = url.pathname.slice(1).split("/")[0];
    } else if (host === "youtube.com" || host === "youtube-nocookie.com") {
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts[0] === "watch") id = url.searchParams.get("v");
      else if (["shorts", "embed", "live", "v"].includes(parts[0])) id = parts[1];
    }

    return id && /^[A-Za-z0-9_-]{11}$/.test(id)
      ? `https://www.youtube-nocookie.com/embed/${id}`
      : null;
  } catch {
    return null;
  }
}

export default function FarmPopup({ farm, videoUrl, imageUrls, prevId, nextId }) {
  const router = useRouter();
  const [current, setCurrent] = useState(0);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [sent, setSent] = useState(false);
  const [closing, setClosing] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [pendingQuestion, setPendingQuestion] = useState(null);
  const wrapperRef = useRef(null);
  const chatLogRef = useRef(null);
  const touchX = useRef(null);

  const youTubeEmbed = videoUrl ? getYouTubeEmbedUrl(videoUrl) : null;
  const slides = [
    ...(videoUrl
      ? [youTubeEmbed ? { type: "youtube", src: youTubeEmbed } : { type: "video", src: videoUrl }]
      : []),
    ...imageUrls.map((src) => ({ type: "photo", src })),
  ];
  const hasMany = slides.length > 1;
  const currentIsVideo =
    slides[current]?.type === "video" || slides[current]?.type === "youtube";

  const closePopup = () => {
    if (closing) return;
    setClosing(true);
    setTimeout(() => router.push("/farm"), 250);
  };

  useEffect(() => {
    document.documentElement.classList.add("farm-open");
    return () => document.documentElement.classList.remove("farm-open");
  }, []);

  useEffect(() => {
    if (slides[current]?.type !== "video") {
      wrapperRef.current?.querySelectorAll("video").forEach((v) => v.pause());
    }
  }, [current]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest?.("input, textarea, video")) return;
      if (e.key === "ArrowLeft" && prevId) router.push(`/farms/${encodeURIComponent(prevId)}`);
      if (e.key === "ArrowRight" && nextId) router.push(`/farms/${encodeURIComponent(nextId)}`);
      if (e.key === "Escape") closePopup();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [prevId, nextId, router]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (chatLogRef.current) chatLogRef.current.scrollTop = chatLogRef.current.scrollHeight;
  }, [messages, thinking]);

  const go = (step) => setCurrent((i) => (i + step + slides.length) % slides.length);

  // swipe on photos only, so scrubbing a video never changes the slide
  const onTouchStart = (e) => {
    touchX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e) => {
    if (touchX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    touchX.current = null;
    if (hasMany && !currentIsVideo && Math.abs(dx) > 50) {
      go(dx < 0 ? 1 : -1);
    }
  };

  const sendChat = async (e) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || thinking) return;

    const givingEmail = pendingQuestion !== null;
    const question = givingEmail ? pendingQuestion : text;
    const email = givingEmail ? text : "";
    const reply = (botText) => setMessages((m) => [...m, { from: "bot", text: botText }]);

    setMessages((m) => [...m, { from: "user", text }]);
    setDraft("");
    setSent(true);
    setTimeout(() => setSent(false), 400);
    setThinking(true);

    try {
      const res = await fetch(`/api/farms/${encodeURIComponent(farm.id)}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, email }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        reply(data.error || "Sorry, something went wrong. Please try again.");
      } else {
        const chatReply = getFarmChatReply(data, { email, question });
        setPendingQuestion(chatReply.pendingQuestion);
        reply(chatReply.reply);
      }
    } catch {
      reply("Network error. Please check your connection and try again.");
    } finally {
      setThinking(false);
    }
  };

  const place =
    farm.province && !farm.location.toLowerCase().includes(farm.province.toLowerCase())
      ? [farm.location, farm.province].filter(Boolean).join(", ")
      : farm.location || farm.province;

  const directions =
    farm.latitude && farm.longitude
      ? `https://www.google.com/maps/search/?api=1&query=${farm.latitude},${farm.longitude}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${farm.name} ${farm.location}`)}`;

  const flags = parseSeason(farm.bearingSeason);
  const anyOn = flags.some(Boolean);
  const start =
    flags.every(Boolean) || !anyOn
      ? 0
      : flags.findIndex((on, i) => on && !flags[(i + 11) % 12]);
  const chips = Array.from({ length: 12 }, (_, k) => {
    const m = (start + k) % 12;
    return { label: MONTHS[m][0].toUpperCase() + MONTHS[m].slice(1), on: flags[m] };
  });

  return (
    <div className={`farm-page-container${closing ? " closing" : ""}`}>
      <div className="farm-primary-content">
        <div className="media-carousel-container">
          <div
            className="carousel-wrapper"
            ref={wrapperRef}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            {slides.length === 0 && (
              <p style={{ color: "#fff", padding: "2rem" }}>No photos available yet.</p>
            )}
            {slides.map((slide, i) => (
              <div
                key={slide.src + i}
                className={`carousel-slide${i === current ? " active" : ""}`}
                data-type={slide.type}
              >
                {slide.type === "youtube" ? (
                  i === current ? (
                    <iframe
                      src={slide.src}
                      title={`${farm.name} video walkthrough`}
                      allow="accelerometer; autoplay; encrypted-media; picture-in-picture; fullscreen"
                      allowFullScreen
                      referrerPolicy="strict-origin-when-cross-origin"
                      loading="lazy"
                    />
                  ) : null
                ) : slide.type === "video" ? (
                  <video controls preload="metadata" poster={imageUrls[0] || undefined}>
                    <source src={slide.src} type="video/mp4" />
                  </video>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={slide.src}
                    alt={`${farm.name} photo ${i + 1}`}
                    onError={(e) => (e.currentTarget.style.display = "none")}
                  />
                )}
              </div>
            ))}
          </div>

          {/* counter, dots and arrows only exist when there is more than one slide */}
          {hasMany && (
            <span className="slide-counter">{current + 1} / {slides.length}</span>
          )}
          {currentIsVideo && <span className="slide-badge">Video Walkthrough</span>}

          {hasMany && (
            <>
              <div className="carousel-dots">
                {slides.map((_, i) => (
                  <span key={i} className={i === current ? "is-active" : ""} />
                ))}
              </div>
              <button type="button" className="media-arrow prev" aria-label="Previous photo" onClick={() => go(-1)}>&#8249;</button>
              <button type="button" className="media-arrow next" aria-label="Next photo" onClick={() => go(1)}>&#8250;</button>
            </>
          )}
        </div>
      </div>

      {prevId && (
        <button type="button" className="farm-nav prev" aria-label="Previous farm"
          onClick={() => router.push(`/farms/${encodeURIComponent(prevId)}`)}>&#8249;</button>
      )}
      {nextId && (
        <button type="button" className="farm-nav next" aria-label="Next farm"
          onClick={() => router.push(`/farms/${encodeURIComponent(nextId)}`)}>&#8250;</button>
      )}

      <button type="button" className="farm-close" aria-label="Close" onClick={closePopup}>
        &#10005;
      </button>

      <aside className="farm-info-sidebar">
        <div className="sidebar-card">
          {(prevId || nextId) && (
            <div className="farm-switch-row">
              {prevId ? (
                <button type="button" onClick={() => router.push(`/farms/${encodeURIComponent(prevId)}`)}>
                  &#8249; Previous farm
                </button>
              ) : <span />}
              {nextId ? (
                <button type="button" onClick={() => router.push(`/farms/${encodeURIComponent(nextId)}`)}>
                  Next farm &#8250;
                </button>
              ) : <span />}
            </div>
          )}

          {farm.type && <span className="farm-type">{farm.type}</span>}
          <h1>{farm.name}</h1>

          {farm.rating && (
            <p className="rating">
              <span className="star">★</span>{" "}
              <strong>{Number(farm.rating).toFixed(1)}</strong>
              {farm.reviews ? ` · ${farm.reviews} reviews` : ""}
            </p>
          )}
          {place && <p className="location-sub">{place}</p>}
          <hr />
          <p>{farm.description || "Come and visit this farm for fresh, locally grown fruit."}</p>

          <dl className="info-list">
            <dt>Hours</dt>
            <dd>{farm.hours || "N/A"}</dd>
            <dt>Crops</dt>
            <dd>{farm.crops.length ? farm.crops.join(", ") : "Fresh produce"}</dd>
            <dt>Season</dt>
            <dd>{farm.bearingSeason || "N/A"}</dd>
            <dt>Contact</dt>
            <dd>
              {farm.phone ? (
                <a className="contact-link" href={`tel:${farm.phone.replace(/[^\d+]/g, "")}`}>
                  {farm.phone}
                </a>
              ) : (
                "Not listed"
              )}
            </dd>
            <dt>Location</dt>
            <dd>
              <span className="loc-text">{farm.location || farm.province}</span>
              <a className="directions-link" href={directions} target="_blank" rel="noopener noreferrer">
                Directions
              </a>
            </dd>
          </dl>

          {anyOn && (
            <section className="farm-section">
              <h2>Harvest season</h2>
              <ul className="season-chips">
                {chips.map((c) => (
                  <li key={c.label} className={c.on ? "on" : ""}>{c.label}</li>
                ))}
              </ul>
            </section>
          )}

          {farm.activities.length > 0 && (
            <section className="farm-section">
              <h2>Activities</h2>
              <ul className="activity-tags">
                {farm.activities.map((a) => <li key={a}>{a}</li>)}
              </ul>
            </section>
          )}

          <section className="farm-section">
            <h2>Ask about this farm</h2>
            <div className="chat-log" ref={chatLogRef} aria-live="polite">
              <div className="msg bot-msg">
                Hi! Ask me anything about {farm.name}. I&apos;m an AI assistant and answer from this farm&apos;s listing.
              </div>
              {messages.map((m, i) => (
                <div key={i} className={`msg ${m.from === "user" ? "user-msg" : "bot-msg"}`}>{m.text}</div>
              ))}
              {thinking && <div className="msg bot-msg">Thinking...</div>}
            </div>
            <form className="chat-input-form" onSubmit={sendChat}>
              <input
                type={pendingQuestion !== null ? "email" : "text"}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={pendingQuestion !== null ? "Your email address..." : "Type your question..."}
                aria-label={pendingQuestion !== null ? "Your email address" : "Your question"}
                maxLength={pendingQuestion !== null ? 254 : 300}
                disabled={thinking}
              />
              <button type="submit" className={`btn btn-primary${sent ? " pop" : ""}`} disabled={thinking}>
                Send
              </button>
            </form>
            {pendingQuestion !== null && (
              <button
                type="button"
                onClick={() => {
                  setPendingQuestion(null);
                  setDraft("");
                }}
              >
                Ask something else
              </button>
            )}
          </section>
        </div>

        <div className="farm-cta-bar">
          <p className="price">
            {farm.entranceFee ? `₱${farm.entranceFee}` : "Free"}
            {farm.entranceFee ? <span> entrance fee</span> : null}
          </p>
          <Link className="btn btn-primary" href={`/reservation?farmId=${encodeURIComponent(farm.id)}`}>
            Book now
          </Link>
        </div>
      </aside>
    </div>
  );
}