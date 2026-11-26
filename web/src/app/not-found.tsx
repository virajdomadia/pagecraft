import Link from "next/link";
import type { Metadata } from "next";
import { Header } from "@/components/landing/Header";
import { Footer } from "@/components/landing/Footer";
import "./landing.css";

export const metadata: Metadata = { title: "Page not found — Pagecraft" };

export default function NotFound() {
  return (
    <div className="landing">
      <Header />
      <main id="main" tabIndex={-1} className="wrap nf">
        <p className="tag">404</p>
        <h1>There&apos;s nothing at this address.</h1>
        <p className="lede">The address you followed doesn&apos;t point anywhere on Pagecraft.</p>
        <div className="actions"><Link className="btn btn-indigo" href="/">Back to the home page</Link></div>
      </main>
      <Footer />
    </div>
  );
}
