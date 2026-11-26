import Link from "next/link";

export function LogoMark({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={className}>
      <rect width="64" height="64" rx="14" fill="#4338CA" />
      <path d="M18 14 h20 l8 8 v28 h-28 z" fill="#FFFFFF" />
      <path d="M38 14 v8 h8" fill="#C7D2FE" />
      <path d="M30 30 l14 6 l-6 2 l-2 6 z" fill="#FF6B6B" stroke="#4338CA" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2 text-[15px] font-extrabold tracking-tight text-ink no-underline">
      <LogoMark />
      Pagecraft
    </Link>
  );
}
