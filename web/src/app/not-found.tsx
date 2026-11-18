import type { Metadata } from "next";
import { Header } from "@/components/landing/Header";
import { Footer } from "@/components/landing/Footer";

export const metadata: Metadata = { title: "Page not found — Pagecraft" };

export default function NotFound() {
  return (
    <>
      <Header />
      <main id="main" tabIndex={-1} className="wrap nf">
        <p className="tag">404</p>
        <h1>This page hasn&apos;t been published.</h1>
        <p className="lede">The address you followed doesn&apos;t point anywhere on Pagecraft.</p>
        <div className="actions"><a className="btn btn-indigo" href="/">Back to the home page</a></div>
      </main>
      <Footer />
    </>
  );
}
