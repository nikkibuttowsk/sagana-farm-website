"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const LINKS = [
  { label: "Home", href: "/#hero", path: "/", hash: "#hero" },
  { label: "About", href: "/#about", path: "/", hash: "#about" },
  { label: "Farms", href: "/farm", path: "/farm" },
  { label: "Map", href: "/#map-section", path: "/", hash: "#map-section" },
  { label: "Reservation", href: "/reservation", path: "/reservation" },
  { label: "Contact Us", href: "/#contact", path: "/", hash: "#contact" },
];

const SECTION_IDS = ["hero", "about", "map-section", "contact"];
const HEADER_OFFSET = 140;
const SETTLE_MS = 200; 

export default function NavLinks() {
  const pathname = usePathname();
  const [current, setCurrent] = useState("hero");
  const locked = useRef(false);
  const lockTimer = useRef(null);
  const updateRef = useRef(() => {});

  useEffect(() => {
    if (pathname !== "/") return;

    const update = () => {
      const atTop = window.scrollY < 120;
      const atBottom =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 4;

      if (atTop) return setCurrent("hero");

      let found = "hero";
      let bestTop = -Infinity;
      let bestHeight = Infinity;

      for (const id of SECTION_IDS) {
        const el = document.getElementById(id);
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (rect.top > HEADER_OFFSET) continue;
        if (rect.bottom <= HEADER_OFFSET) continue;
        if (
          rect.top > bestTop ||
          (rect.top === bestTop && rect.height < bestHeight)
        ) {
          found = id;
          bestTop = rect.top;
          bestHeight = rect.height;
        }
      }

      if (atBottom) {
        const last = [...SECTION_IDS]
          .reverse()
          .find((id) => document.getElementById(id));
        if (last) found = last;
      }

      setCurrent(found);
    };
    updateRef.current = update;

    const release = () => {
      locked.current = false;
      update();
    };

    const onScroll = () => {
      if (locked.current) {
        clearTimeout(lockTimer.current);
        lockTimer.current = setTimeout(release, SETTLE_MS);
        return;
      }
      update();
    };

    update();
    const t = setTimeout(update, 300);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      clearTimeout(t);
      clearTimeout(lockTimer.current);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", update);
    };
  }, [pathname]);

    useEffect(() => {
    const onAnchor = (e) => handleClick({ hash: `#${e.detail}` });
    window.addEventListener("anchor-scroll", onAnchor);
    return () => window.removeEventListener("anchor-scroll", onAnchor);
  });
  
  function handleClick(link) {
    if (!link.hash || pathname !== "/") return;
    setCurrent(link.hash.slice(1));
    locked.current = true;
    clearTimeout(lockTimer.current);
    lockTimer.current = setTimeout(() => {
      locked.current = false;
      updateRef.current();
    }, SETTLE_MS + 400);
  }

  function isActive(link) {
    if (link.hash) {
      return pathname === "/" && link.hash.slice(1) === current;
    }
    return pathname.startsWith(link.path);
  }

  return (
    <ul>
      {LINKS.map((link) => {
        const active = isActive(link);
        return (
          <li key={link.label}>
            <Link
              href={link.href}
              className={active ? "active" : undefined}
              aria-current={active ? "page" : undefined}
              onClick={() => handleClick(link)}
            >
              {link.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}