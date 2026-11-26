import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/studio/Logo";
import { UserMenu } from "@/components/studio/UserMenu";
import type { Me } from "@/lib/api";

/** The studio's top bar (dashboard, template picker, settings). The editor has its own. */
export function AppBar({ me, crumbs }: { me: Me; crumbs?: { href?: string; label: string }[] }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-paper px-4 sm:px-6">
      <Logo href="/sites" />
      {crumbs?.map((c, i) => (
        <Crumb key={i} href={c.href}>
          {c.label}
        </Crumb>
      ))}
      <div className="flex-1" />
      <UserMenu me={me} />
    </header>
  );
}

function Crumb({ href, children }: { href?: string; children: ReactNode }) {
  return (
    <span className="hidden items-center gap-3 text-sm sm:flex">
      <span className="text-line" aria-hidden="true">
        /
      </span>
      {href ? (
        <Link href={href} className="text-ink-2 no-underline hover:text-ink">
          {children}
        </Link>
      ) : (
        <span className="max-w-[24ch] truncate font-semibold text-ink">{children}</span>
      )}
    </span>
  );
}
