"use client";

import { useEffect } from "react";

/**
 * The published page's only script (04 §7): a gallery lightbox and closing the mobile menu after
 * a link is followed. The nav menu and the FAQ are native <details>, so everything works without
 * JavaScript; this only improves it. Renders nothing.
 */
export function SiteScript() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = e.target as Element | null;
      const menuLink = target?.closest(".pc-nav__menu a");
      if (menuLink) menuLink.closest("details")?.removeAttribute("open");

      const anchor = target?.closest<HTMLAnchorElement>("a[data-pc-lightbox]");
      if (!anchor || e.metaKey || e.ctrlKey || e.shiftKey || typeof HTMLDialogElement === "undefined") return;
      e.preventDefault();
      const img = anchor.querySelector("img");
      const dialog = document.createElement("dialog");
      dialog.className = "pc-lightbox";
      dialog.setAttribute("aria-label", img?.alt || "Photo");
      const full = document.createElement("img");
      full.src = anchor.href;
      full.alt = img?.alt ?? "";
      const close = document.createElement("button");
      close.type = "button";
      close.textContent = "Close";
      close.addEventListener("click", () => dialog.close());
      dialog.append(full, close);
      dialog.addEventListener("close", () => {
        dialog.remove();
        anchor.focus();
      });
      dialog.addEventListener("click", (ev) => {
        if (ev.target === dialog) dialog.close();
      });
      anchor.closest(".pc-site")?.append(dialog);
      dialog.showModal();
      close.focus();
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);
  return null;
}
