import type { Metadata } from "next";
import { ResetForm } from "@/components/auth/PasswordForms";

export const metadata: Metadata = { title: "Choose a new password · Pagecraft", robots: { index: false } };

export default function Reset() {
  return <ResetForm />;
}
