import { site } from "@/lib/site";

/** The free plan's "Made with Pagecraft" pill (R5); Pro (v3) removes it. */
export function Badge() {
  return (
    <a className="pc-badge" href={`${site.url}/?ref=badge`}>
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <rect width="64" height="64" rx="14" fill="#4338CA" />
        <path d="M18 14 h20 l8 8 v28 h-28 z" fill="#FFFFFF" />
        <path d="M30 30 l14 6 l-6 2 l-2 6 z" fill="#FF6B6B" />
      </svg>
      Made with Pagecraft
    </a>
  );
}
