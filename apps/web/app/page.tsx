import { ClosingPrompt } from "@/components/landing/ClosingPrompt";
import { EdgePrint } from "@/components/landing/EdgePrint";
import { HeroDevelop } from "@/components/landing/HeroDevelop";
import { LandingNav } from "@/components/landing/LandingNav";
import { Colophon, ContactSheet, Faq, Pipeline, QaSection } from "@/components/landing/Sections";

export default function Home() {
  return (
    <div data-theme="dark" className="overflow-hidden bg-surface-0 text-ink-2">
      <EdgePrint />
      <div className="mx-auto max-w-[1240px] px-4 sm:px-6">
        <LandingNav />
        <main>
          <HeroDevelop />
          <ContactSheet />
          <Pipeline />
          <QaSection />
          <Faq />
          <ClosingPrompt />
        </main>
        <Colophon />
      </div>
    </div>
  );
}
