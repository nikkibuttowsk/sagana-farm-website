"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

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

export default function FarmPopup({ farm, videoUrl, imageUrls, prevId, nextId }) {
  const router = useRouter();
  const [current, setCurrent] = useState(0);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [sent, setSent] = useState(false);       // Send button bounce
  const [closing, setClosing] = useState(false); // pop-up closing animation
  const wrapperRef = useRef(null);
  const chatLogRef = useRef(null);

  const slides = [
    ...(videoUrl ? [{ type: "video", src: videoUrl }] : []),
    ...imageUrls.map((src) => ({ type: "photo", src })),
  ];

  // open the pop-up (CSS needs "farm-open" on <html>)
  useEffect(() => {
    document.documentElement.classList.add("farm-open");
    return () => document.documentElement.classList.remove("farm-open");
  }, []);

  // new farm -> first slide, empty chat
  useEffect(() => {
    setCurrent(0);
    setMessages([]);
    setClosing(false);
  }, [farm.id]);

  // pause the video when it is not the visible slide
  useEffect(() => {
    if (slides[current]?.type !== "video") {
      wrapperRef.current?.querySelectorAll("video").forEach((v) => v.pause());
    }
  }, [current]); // eslint-disable-line react-hooks/exhaustive-deps

  // keyboard: left / right arrows move between farms
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

  // keep the chat scrolled to the newest message
  useEffect(() => {
    if (chatLogRef.current) chatLogRef.current.scrollTop = chatLogRef.current.scrollHeight;
  }, [messages]);

  const go = (step) => setCurrent((i) => (i + step + slides.length) % slides.length);

  // play the closing animation, then leave the page
  const closePopup = () => {
    if (closing) return;
    setClosing(true);
    setTimeout(() => router.push("/farm"), 250);
  };

  const sendChat = (e) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setMessages((m) => [...m, { from: "user", text }]);
    setDraft("");
    setSent(true);
    setTimeout(() => setSent(false), 400);
    setTimeout(() => {
      setMessages((m) => [
        ...m,
        { from: "bot", text: "Thanks for reaching out! Our team has logged your question and will reply shortly." },
      ]);
    }, 600);
  };

  // header info
  const place =
    farm.province && !farm.location.toLowerCase().includes(farm.province.toLowerCase())
      ? [farm.location, farm.province].filter(Boolean).join(", ")
      : farm.location || farm.province;

  const directions =
    farm.latitude && farm.longitude
      ? `https://www.google.com/maps/search/?api=1&query=${farm.latitude},${farm.longitude}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${farm.name} ${farm.location}`)}`;

  // harvest-season chips, starting at the first harvest month
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
          <div className="carousel-wrapper" ref={wrapperRef}>
            {slides.length === 0 && (
              <p style={{ color: "#fff", padding: "2rem" }}>No photos available yet.</p>
            )}
            {slides.map((slide, i) => (
              <div
                key={slide.src + i}
                className={`carousel-slide${i === current ? " active" : ""}`}
                data-type={slide.type}
              >
                {slide.type === "video" ? (
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

          {slides.length > 0 && (
            <span className="slide-counter">{current + 1} / {slides.length}</span>
          )}
          {slides[current]?.type === "video" && (
            <span className="slide-badge">Video Walkthrough</span>
          )}

          {slides.length > 1 && (
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
            {farm.phone && (
              <>
                <dt>Phone</dt>
                <dd><a href={`tel:${farm.phone.replace(/[^\d+]/g, "")}`}>{farm.phone}</a></dd>
              </>
            )}
            <dt>Location</dt>
            <dd>
              {farm.location || farm.province}{" "}
              <a href={directions} target="_blank" rel="noopener noreferrer">Directions</a>
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
            <div className="chat-log" ref={chatLogRef}>
              <div className="msg bot-msg">Hi! Ask me anything about {farm.name}.</div>
              {messages.map((m, i) => (
                <div key={i} className={`msg ${m.from === "user" ? "user-msg" : "bot-msg"}`}>{m.text}</div>
              ))}
            </div>
            <form className="chat-input-form" onSubmit={sendChat}>
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Type your question..."
                aria-label="Your question"
              />
              <button type="submit" className={`btn btn-primary${sent ? " pop" : ""}`}>
                Send
              </button>
            </form>
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