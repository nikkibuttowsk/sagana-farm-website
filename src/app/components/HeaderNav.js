"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import NavLinks from "./NavLinks";

export default function HeaderNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <>
      <button
        type="button"
        className="nav-toggle"
        aria-expanded={open}
        aria-controls="main-nav"
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((o) => !o)}
      >
        <span aria-hidden="true">{open ? "✕" : "☰"}</span>
      </button>

      <nav
        id="main-nav"
        aria-label="Main navigation"
        className={open ? "open" : undefined}
        onClick={(e) => {
          // close when a link is tapped (covers #section links too)
          if (e.target.closest("a")) setOpen(false);
        }}
      >
        <NavLinks />
      </nav>
    </>
  );
}