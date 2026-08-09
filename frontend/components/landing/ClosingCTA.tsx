import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function ClosingCTA() {
  return (
    <section className="mx-auto max-w-[1280px] px-6 pb-24 lg:px-10">
      <div
        className="relative overflow-hidden rounded-[24px] border border-border-hairline px-6 py-20 text-center"
        style={{
          background:
            "radial-gradient(circle at 30% 20%, rgba(120,90,200,0.22), transparent 55%), radial-gradient(circle at 75% 80%, rgba(225,77,95,0.16), transparent 50%), #131629",
        }}
      >
        <h2 className="mx-auto max-w-2xl text-[34px] font-bold leading-[1.15] tracking-tight text-text-heading sm:text-[42px]">
          Give your pipelines an engineering team that never clocks out
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-[16px] leading-relaxed text-text-body">
          Bring one broken pipeline to a 30-minute session. We&apos;ll connect
          Atlas AI live and show you the fix it proposes before you leave the
          call.
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
          <Link href="/demo" className="btn-primary">
            Book your demo <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/dashboard" className="btn-secondary">
            Explore the control center
          </Link>
        </div>
        <p className="mt-6 font-mono-atlas text-[11px] uppercase tracking-[0.12em] text-text-muted">
          No credit card · Read-only pilot · Cancel anytime
        </p>
      </div>
    </section>
  );
}
