"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Photo } from "@/components/ui/Photo";

/** The last section: type a request here and it carries over as the draft on the new-run page. */
export function ClosingPrompt() {
  const router = useRouter();
  const [text, setText] = useState("");

  const go = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim()) {
      try {
        localStorage.setItem("atlas.draft", text.trim());
      } catch {}
    }
    router.push("/new");
  };

  return (
    <section className="pt-24 md:pt-[168px]">
      <div className="relative flex min-h-[460px] items-end overflow-hidden rounded-[36px] bg-surface-1">
        <Photo
          src="/images/survey-map.webp"
          alt="A hand-drawn topographic survey map with a brass compass, lit by a lamp"
          drift
          sizes="(min-width: 1240px) 1192px, 100vw"
          className="!absolute inset-0 rounded-none"
        />
        <div aria-hidden className="absolute inset-0 bg-[linear-gradient(90deg,rgb(20_19_17/0.92)_0%,rgb(20_19_17/0.6)_45%,rgb(20_19_17/0.1)_100%)]" />
        <div aria-hidden className="safelight-glow absolute inset-0" />
        <form onSubmit={go} data-theme="dark" className="relative flex w-full flex-col gap-[22px] p-6 sm:p-12">
          <h2 className="text-[clamp(40px,6vw,84px)] leading-[0.95] font-semibold tracking-[-0.04em] text-ink">
            What should
            <br />
            Atlas develop?
          </h2>
          <div className="flex max-w-[760px] flex-wrap gap-2.5">
            <label htmlFor="closing-prompt" className="sr-only">Describe a pipeline</label>
            <input
              id="closing-prompt"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Daily orders per plan tier…"
              className="h-14 min-w-0 flex-[1_1_360px] rounded-[18px] bg-[rgb(20_19_17/0.85)] px-5 text-[17px] text-ink shadow-[inset_0_0_0_1px_rgb(237_235_230/0.1)] placeholder:text-ink-3 focus:outline-none focus-visible:shadow-[inset_0_0_0_1px_var(--moss)]"
            />
            <button className="inline-flex h-14 items-center gap-2.5 rounded-[18px] bg-safelight px-6 text-[16px] font-semibold text-action-ink hover:brightness-105">
              Develop <span aria-hidden>↵</span>
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
