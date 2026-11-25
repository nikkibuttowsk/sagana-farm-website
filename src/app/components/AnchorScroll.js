"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const reduceMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function flash(el) {
  if (!el.animate) return;
  el.animate(
    [
      { boxShadow: "0 0 0 0 rgba(26,122,67,0)", backgroundColor: "rgba(26,122,67,0)" },
      {
        boxShadow: "0 0 0 6px rgba(26,122,67,0.35)",
        backgroundColor: "rgba(26,122,67,0.08)",
        offset: 0.3,
      },
      { boxShadow: "0 0 0 0 rgba(26,122,67,0)", backgroundColor: "rgba(26,122,67,0)" },
    ],
    { duration: 900, easing: "ease-out" },
  );
}

export default function AnchorScroll() {
  const pathname = usePathname();

  useEffect(() => {
    const onClick = (e) => {
      const link = e.target.closest?.("a[href]");
      if (!link) return;

      const url = new URL(link.href, window.location.origin);
      if (url.origin !== window.location.origin) return;
      if (url.pathname !== window.location.pathname || !url.hash) return;

      const id = decodeURIComponent(url.hash.slice(1));
      const el = document.getElementById(id);
      if (!el) return;

      e.preventDefault();
      e.stopImmediatePropagation();
      history.pushState(null, "", url.hash);


      window.dispatchEvent(new CustomEvent("anchor-scroll", { detail: id }));

      el.scrollIntoView({
        behavior: reduceMotion() ? "auto" : "smooth",
        block: "start",
      });
      if (!reduceMotion()) setTimeout(() => flash(el), 250);
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);


  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (!hash || reduceMotion()) return;
    const t = setTimeout(() => {
      const el = document.getElementById(decodeURIComponent(hash));
      if (el) flash(el);
    }, 400);
    return () => clearTimeout(t);
  }, [pathname]);

  return null;
}