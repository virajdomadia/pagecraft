/** Line icons for feature items (24 px, stroke = currentColor). Keys mirror ICONS in
 * api/app/sections.py. */

export const ICON_KEYS = [
  "cup",
  "leaf",
  "clock",
  "wifi",
  "star",
  "heart",
  "scissors",
  "sparkle",
  "dumbbell",
  "bolt",
  "shield",
  "truck",
  "pin",
  "phone",
  "calendar",
  "chef",
  "wine",
  "palette",
  "pen",
  "camera",
  "check",
  "gift",
] as const;
export type IconKey = (typeof ICON_KEYS)[number];

const PATHS: Record<IconKey, string[]> = {
  cup: ["M4 8h13v5a6 6 0 0 1-6 6h-1a6 6 0 0 1-6-6z", "M17 10h1.5a2.5 2.5 0 0 1 0 5H17", "M8 2.5v3M12 2.5v3"],
  leaf: ["M5 19c0-9 6-14 15-14 0 9-5 15-14 15", "M5 19l7-7"],
  clock: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z", "M12 7v5l3 2"],
  wifi: ["M2 9a15 15 0 0 1 20 0", "M5 12.5a10 10 0 0 1 14 0", "M8.5 16a5 5 0 0 1 7 0", "M12 19.5h.01"],
  star: ["M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"],
  heart: ["M12 20s-7-4.4-9-9a4.5 4.5 0 0 1 9-3 4.5 4.5 0 0 1 9 3c-2 4.6-9 9-9 9z"],
  scissors: ["M6 9.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z", "M6 19.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z", "M8 8.5 20 18M8 15.5 20 6"],
  sparkle: ["M12 3v4M12 17v4M3 12h4M17 12h4", "M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"],
  dumbbell: ["M6 7v10M3 9v6M18 7v10M21 9v6M6 12h12"],
  bolt: ["M13 2 4 14h7l-1 8 9-12h-7z"],
  shield: ["M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z", "M9 12l2 2 4-4"],
  truck: ["M3 6h11v10H3z", "M14 10h4l3 3v3h-7", "M7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"],
  pin: ["M12 21s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12z", "M12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"],
  phone: ["M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 3 5a2 2 0 0 1 2-2z"],
  calendar: ["M4 6h16v15H4z", "M4 10h16M8 3v4M16 3v4"],
  chef: ["M7 14v6h10v-6", "M7 14a4 4 0 0 1-1-7.9A4 4 0 0 1 12 4a4 4 0 0 1 6 2.1A4 4 0 0 1 17 14z", "M7 17h10"],
  wine: ["M8 3h8l-1 6a3 3 0 0 1-6 0z", "M12 12v8M8 21h8"],
  palette: ["M12 3a9 9 0 1 0 0 18c1.5 0 2-1 2-2s-1-2 0-3 2-1 3-1a4 4 0 0 0 4-4c0-4.4-4-8-9-8z", "M7.5 11h.01M10 7h.01M15 7.5h.01"],
  pen: ["M4 20l4-1L19 8a2.1 2.1 0 0 0-3-3L5 16z", "M14 7l3 3"],
  camera: ["M4 8h3l2-3h6l2 3h3v11H4z", "M12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z"],
  check: ["M4 12l5 5L20 6"],
  gift: ["M4 10h16v4H4z", "M6 14h12v7H6z", "M12 10v11", "M12 10C9 10 6.5 8.5 7 6.5S10.5 6 12 10c1.5-4 4.5-5.5 5-3.5S15 10 12 10z"],
};

export function Icon({ name, className = "" }: { name: string; className?: string }) {
  const paths = PATHS[name as IconKey] ?? PATHS.star;
  return (
    <svg
      className={`pc-icon ${className}`}
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
