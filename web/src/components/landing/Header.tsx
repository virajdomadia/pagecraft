"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

const links = [
  { href: "/#features", label: "Features" },
  { href: "/#examples", label: "Examples" },
  { href: "/#plans", label: "Plans" },
  { href: "/#try", label: "Try the demo" },
];

export function Header() {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const mq = window.matchMedia("(min-width: 901px)");
    const onWide = () => mq.matches && setOpen(false);
    document.addEventListener("keydown", onKey);
    mq.addEventListener("change", onWide);
    return () => {
      document.removeEventListener("keydown", onKey);
      mq.removeEventListener("change", onWide);
    };
  }, [open]);

  return (
    <header className="wrap">
      <a className="skip" href="#main">Skip to content</a>
      <nav className="nav" aria-label="Main">
        <Link className="logo" href="/"><svg viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="14" fill="#4338CA"/><path d="M18 14 h20 l8 8 v28 h-28 z" fill="#FFFFFF"/><path d="M38 14 v8 h8" fill="#C7D2FE"/><path d="M30 30 l14 6 l-6 2 l-2 6 z" fill="#FF6B6B" stroke="#4338CA" strokeWidth="1.5" strokeLinejoin="round"/></svg>Pagecraft</Link>
        <ul className="nav-links">{links.map((l) => <li key={l.href}><a href={l.href}>{l.label}</a></li>)}</ul>
        <div className="nav-end">
          <a className="btn btn-line" href="/sign-in">Sign in</a>
          <button
            ref={buttonRef}
            type="button"
            className="btn btn-line menu-btn"
            aria-expanded={open}
            aria-controls={menuId}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? "Close" : "Menu"}
          </button>
        </div>
      </nav>
      <div id={menuId} className="mobile-menu" hidden={!open}>
        <ul>{links.map((l) => <li key={l.href}><a href={l.href} onClick={() => setOpen(false)}>{l.label}</a></li>)}</ul>
      </div>
    </header>
  );
}
