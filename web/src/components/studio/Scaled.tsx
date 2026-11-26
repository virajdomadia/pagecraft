"use client";

import { type ReactNode, useLayoutEffect, useRef, useState } from "react";

/**
 * Renders `children` laid out at `width` px and scaled down to fit the parent — a live
 * thumbnail of a real page (dashboard cards, template previews) with no screenshot to store.
 * `inert`: a thumbnail is a picture, so nothing inside it is focusable or clickable.
 */
export function Scaled({
  width,
  children,
  height,
  className = "",
  label,
}: {
  width: number;
  children: ReactNode;
  /** Fixed viewport height in layout px; omit to show the full height. */
  height?: number;
  className?: string;
  label?: string;
}) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  const [innerHeight, setInnerHeight] = useState(0);

  useLayoutEffect(() => {
    const o = outer.current;
    const i = inner.current;
    if (!o || !i) return;
    const update = () => {
      setScale(o.clientWidth / width);
      setInnerHeight(i.scrollHeight);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(o);
    ro.observe(i);
    return () => ro.disconnect();
  }, [width]);

  const h = (height ?? innerHeight) * scale;
  return (
    <div
      ref={outer}
      className={`relative overflow-hidden ${className}`}
      style={{ height: h || undefined, aspectRatio: h ? undefined : height ? `${width} / ${height}` : undefined }}
      role={label ? "img" : undefined}
      aria-label={label}
    >
      <div
        ref={inner}
        inert
        aria-hidden="true"
        style={{
          width,
          transform: `scale(${scale})`,
          transformOrigin: "0 0",
          position: "absolute",
          top: 0,
          left: 0,
          opacity: scale ? 1 : 0,
        }}
      >
        {children}
      </div>
    </div>
  );
}
