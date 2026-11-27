import type { Metadata } from "next";
import { ForgotForm } from "@/components/auth/PasswordForms";

export const metadata: Metadata = { title: "Reset your password · Pagecraft", robots: { index: false } };

export default function Forgot() {
  return <ForgotForm />;
}
