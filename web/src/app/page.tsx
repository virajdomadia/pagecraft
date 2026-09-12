import { Header } from "@/components/landing/Header";
import { Hero } from "@/components/landing/Hero";
import { Features } from "@/components/landing/Features";
import { Plans } from "@/components/landing/Plans";
import { Cta } from "@/components/landing/Cta";
import { Footer } from "@/components/landing/Footer";

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <Features />
        <Plans />
        <Cta />
      </main>
      <Footer />
    </>
  );
}
