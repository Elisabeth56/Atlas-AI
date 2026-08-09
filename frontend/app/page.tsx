import { Nav } from "@/components/layout/Nav";
import { Footer } from "@/components/layout/Footer";
import { Hero } from "@/components/landing/Hero";
import { WhoItsFor } from "@/components/landing/WhoItsFor";
import { AgentFleet } from "@/components/landing/AgentFleet";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { WhyAtlas } from "@/components/landing/WhyAtlas";
import { Testimonials } from "@/components/landing/Testimonials";
import { FAQ } from "@/components/landing/FAQ";
import { ClosingCTA } from "@/components/landing/ClosingCTA";

export default function Home() {
  return (
    <>
      <Nav />
      <main className="flex-1">
        <Hero />
        <WhoItsFor />
        <AgentFleet />
        <HowItWorks />
        <WhyAtlas />
        <Testimonials />
        <FAQ />
        <ClosingCTA />
      </main>
      <Footer />
    </>
  );
}
