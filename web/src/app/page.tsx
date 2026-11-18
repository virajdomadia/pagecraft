import type { Metadata } from "next";
import { Header } from "@/components/landing/Header";
import { Hero } from "@/components/landing/Hero";
import { Features } from "@/components/landing/Features";
import { Plans } from "@/components/landing/Plans";
import { Cta } from "@/components/landing/Cta";
import { EarlyAccess } from "@/components/landing/EarlyAccess";
import { Footer } from "@/components/landing/Footer";

export const metadata: Metadata = { alternates: { canonical: "/" } };

export default function Home() {
  return (
    <>
      <Header />
      <main id="main" tabIndex={-1}>
        <Hero />
        <Features />
        <Plans />
        <Cta />
        <EarlyAccess />
      </main>
      <Footer />
    </>
  );
}
