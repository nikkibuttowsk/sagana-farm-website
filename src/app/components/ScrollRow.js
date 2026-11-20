"use client";

import { useEffect, useRef, useState } from "react";
import "./scroll-row.css";

export default function ScrollRow({ className = "season-row", children }) {
  const ref = useRef(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      setCanLeft(el.scrollLeft > 4);
      setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [children]);

  const scroll = (dir) =>
    ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.8, behavior: "smooth" });

  return (
    <div className="scroll-wrap">
      {canLeft && (
        <button type="button" className="scroll-arrow left" aria-label="Scroll left" onClick={() => scroll(-1)}>
          ‹
        </button>
      )}
      <div ref={ref} className={className}>
        {children}
      </div>
      {canRight && (
        <button type="button" className="scroll-arrow right" aria-label="Scroll right" onClick={() => scroll(1)}>
          ›
        </button>
      )}
    </div>
  );
}