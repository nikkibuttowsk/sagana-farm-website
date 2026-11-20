"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const LINKS = [
  { label: "Home", href: "/#hero", path: "/", hash: "#hero" },
  { label: "About", href: "/#about", path: "/", hash: "#about" },
  { label: "Farms", href: "/farm", path: "/farm" },
  { label: "Map", href: "/#map-section", path: "/", hash: "#map-section" },
  { label: "Reservation", href: "/reservation", path: "/reservation" },
  { label: "Contact Us", href: "/#contact", path: "/", hash: "#contact" },
];

export default function NavLinks() {
  const pathname = usePathname();
  const [hash, setHash] = useState("");

  useEffect(() => {
    const read = () => setHash(window.location.hash);
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, [pathname]);

  function isActive(link) {
    if (link.hash) {
      if (pathname !== "/") return false;
      return hash === link.hash || (link.hash === "#hero" && hash === "");
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
              onClick={() => link.hash && setHash(link.hash)}
            >
              {link.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}