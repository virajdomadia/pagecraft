import type { Metadata } from "next";
import { AcceptInvite } from "@/components/auth/AcceptInvite";

export const metadata: Metadata = { title: "Invite · Pagecraft", robots: { index: false }, referrer: "no-referrer" };

/** S12. The token never leaves this tab in a Referer header. */
export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <AcceptInvite token={token} />;
}
