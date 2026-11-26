import type { ThumbBox } from "@/sections/types";

/** A variant's wireframe thumbnail (S6/S7): the section's layout boxes on a 120 × 72 sheet. */
export function Thumb({ boxes, className = "" }: { boxes: ThumbBox[]; className?: string }) {
  return (
    <svg viewBox="0 0 120 72" className={`block h-auto w-full ${className}`} aria-hidden="true">
      <rect x="0.5" y="0.5" width="119" height="71" rx="2" fill="#fff" stroke="#DCDAE8" />
      {boxes.map(([x, y, w, h, kind = "text"], i) => {
        switch (kind) {
          case "head":
            return <rect key={i} x={x} y={y} width={w} height={h} rx="1" fill="#1B1B2F" opacity="0.82" />;
          case "img":
            return (
              <g key={i}>
                <rect x={x} y={y} width={w} height={h} rx="1.5" fill="#EEF0FF" stroke="#4338CA" strokeWidth="0.8" strokeDasharray="2 1.5" />
                <path d={`M${x} ${y + h}L${x + w} ${y}M${x} ${y}L${x + w} ${y + h}`} stroke="#4338CA" strokeWidth="0.5" opacity="0.5" />
              </g>
            );
          case "btn":
            return <rect key={i} x={x} y={y} width={w} height={h} rx="2" fill="#4338CA" />;
          case "box":
            return <rect key={i} x={x} y={y} width={w} height={h} rx="1.5" fill="none" stroke="#6E6E8C" strokeWidth="0.9" />;
          default:
            return <rect key={i} x={x} y={y} width={w} height={h} rx="1" fill="#B8B8CC" />;
        }
      })}
    </svg>
  );
}
