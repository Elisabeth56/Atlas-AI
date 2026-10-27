import Link from "next/link";
import { buttonStyles } from "@/components/ui/Button";
import { Photo } from "@/components/ui/Photo";

/** Nothing at this address: the survey map, one line on why, and the way back. */
export function LostRun({ what = "run" }: { what?: "run" | "page" }) {
  return (
    <div className="mx-auto grid max-w-[1000px] items-center gap-8 px-4 py-16 sm:px-8 md:grid-cols-[1.1fr_0.9fr]">
      <Photo
        src="/images/survey-map.webp"
        alt="A topographic survey map with a brass compass"
        className="aspect-[16/10]"
        sizes="(min-width: 768px) 540px, 100vw"
      />
      <div className="flex flex-col gap-4">
        <span className="text-eyebrow text-moss">off the map</span>
        <h1 className="text-[32px] leading-[1.1] font-semibold tracking-[-0.03em] text-ink">
          {what === "run" ? "This run isn’t in your workspace" : "Nothing at this address"}
        </h1>
        <p className="text-body text-ink-2">
          {what === "run"
            ? "It may belong to another workspace, or the link is wrong. Runs are private to the workspace that started them."
            : "The page may have moved, or the link is wrong."}
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/new" className={buttonStyles("primary", "lg")}>
            Start a run
          </Link>
        </div>
      </div>
    </div>
  );
}
