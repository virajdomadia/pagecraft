import type { Metadata } from "next";
import { Header } from "@/components/landing/Header";
import { Hero } from "@/components/landing/Hero";
import { Features } from "@/components/landing/Features";
import { Plans } from "@/components/landing/Plans";
import { Cta } from "@/components/landing/Cta";
import { TryIt } from "@/components/landing/TryIt";
import "./landing.css";
import { Footer } from "@/components/landing/Footer";

export const metadata: Metadata = { alternates: { canonical: "/" } };

export default function Home() {
  return (
    <div className="landing">
      <Header />
      <main id="main" tabIndex={-1}>
        <Hero />
        <Features />
        <TryIt />
        <Plans />
        <Cta />
      </main>
      <Footer />
    </div>
  );
}
