import { Users, Target, Lock, Wallet, Clock, FileCode2 } from "lucide-react";
import { Eyebrow } from "@/components/ui/Eyebrow";

const features = [
  {
    icon: Users,
    title: "Reviewable by design",
    body: "Agents never touch production directly. Everything lands as a pull request with a diff, a rationale and a rollback path.",
  },
  {
    icon: Target,
    title: "Lineage-aware reasoning",
    body: "Atlas plans against a live dependency graph, so a fix upstream accounts for every downstream model and dashboard.",
  },
  {
    icon: Lock,
    title: "Runs in your perimeter",
    body: "Deploy inside your own cloud account. Credentials stay yours and your data is never used to train models.",
  },
  {
    icon: Wallet,
    title: "Cost is a first-class metric",
    body: "Every plan estimates compute before it runs, and the Ledger agent works continuously to keep spend under budget.",
  },
  {
    icon: Clock,
    title: "Minutes, not sprints",
    body: "Median incident repair is three minutes. New source onboarding that took a quarter now closes in an afternoon.",
  },
  {
    icon: FileCode2,
    title: "Your stack, your standards",
    body: "Atlas writes in the conventions of your repo — naming, folder structure, testing patterns and style guides included.",
  },
];

export function WhyAtlas() {
  return (
    <section className="mx-auto max-w-[1280px] px-6 py-24 lg:px-10">
      <div className="grid grid-cols-1 gap-14 lg:grid-cols-[0.85fr_1.15fr]">
        <div>
          <Eyebrow>Why Atlas AI</Eyebrow>
          <h2 className="mt-6 text-[36px] font-bold leading-[1.15] tracking-tight text-text-heading sm:text-[42px]">
            Autonomy you can actually put in front of an auditor
          </h2>
          <p className="mt-5 text-[16px] leading-relaxed text-text-body">
            Most tools generate code. Atlas takes responsibility for the
            outcome — proving each change is safe before it ever reaches a
            consumer.
          </p>
          <div className="mt-10 flex gap-10 border-t border-border-hairline pt-6">
            <div>
              <p className="text-[13px] text-text-body">Median repair time</p>
              <p className="mt-1 text-[28px] font-bold text-text-heading">3m 12s</p>
            </div>
            <div>
              <p className="text-[13px] text-text-body">Changes shipped as PRs</p>
              <p className="mt-1 text-[28px] font-bold text-text-heading">100%</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {features.map((f) => (
            <div key={f.title} className="card-atlas p-6">
              <f.icon className="h-5 w-5 text-accent" strokeWidth={1.75} />
              <h3 className="mt-4 text-[16px] font-semibold text-text-heading">{f.title}</h3>
              <p className="mt-2.5 text-[14px] leading-relaxed text-text-body">{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
