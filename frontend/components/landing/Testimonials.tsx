import { Eyebrow } from "@/components/ui/Eyebrow";

const quotes = [
  {
    quote:
      "We retired an entire rotation of overnight pipeline babysitting. Atlas files the fix, we review it with coffee, and the warehouse is green by 8am.",
    name: "Nadia Okonjo",
    role: "Head of Data Platform, Northlane Logistics",
    initial: "N",
  },
  {
    quote:
      "The plan-before-execute model is what got it past our risk committee. Nothing moves without a diff, an owner and an estimated cost.",
    name: "Marcus Feld",
    role: "VP Engineering, Cindral Financial",
    initial: "M",
  },
  {
    quote:
      "Onboarding a new source used to be a two-sprint project. Our last one took a single afternoon, tests and documentation included.",
    name: "Priya Raghavan",
    role: "Analytics Engineering Lead, Verabio",
    initial: "P",
  },
];

export function Testimonials() {
  return (
    <section className="border-y border-border-hairline bg-bg-alt py-24">
      <div className="mx-auto max-w-[1280px] px-6 text-center lg:px-10">
        <div className="flex justify-center">
          <Eyebrow>In production</Eyebrow>
        </div>
        <h2 className="mx-auto mt-6 max-w-2xl text-[36px] font-bold leading-[1.15] tracking-tight text-text-heading sm:text-[44px]">
          Trusted where downtime is expensive
        </h2>
        <p className="mx-auto mt-5 max-w-2xl text-[16px] leading-relaxed text-text-body">
          Atlas AI runs inside logistics, financial services and life-sciences
          platforms with strict review and residency requirements.
        </p>

        <div className="mt-14 grid grid-cols-1 gap-5 text-left sm:grid-cols-3">
          {quotes.map((q) => (
            <div key={q.name} className="card-atlas flex flex-col p-6">
              <p className="text-[15px] leading-relaxed text-text-body-strong">
                &ldquo;{q.quote}&rdquo;
              </p>
              <div className="mt-6 flex items-center gap-3 border-t border-border-hairline pt-5">
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-accent text-[13px] font-semibold text-white">
                  {q.initial}
                </span>
                <div>
                  <p className="text-[14px] font-medium text-text-heading">{q.name}</p>
                  <p className="text-[13px] text-text-muted">{q.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
