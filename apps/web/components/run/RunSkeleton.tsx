"use client";

import { useEffect, useState } from "react";

/** The run view's shape while the first fetch is in flight. A free-tier API can take a while to wake. */
export function RunSkeleton() {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 4000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div aria-busy aria-label="Loading the run" className="flex flex-col gap-[22px] px-4 pt-5 sm:px-7">
      <span className="sk h-4 w-64 rounded-full" />
      <span className="sk h-9 w-3/5 rounded-full" />
      <span className="sk h-[150px] rounded-[20px]" />
      <div className="flex flex-wrap gap-5">
        <div className="flex flex-[999_1_520px] flex-col gap-3 rounded-lg bg-surface-1 p-7">
          <span className="sk h-7 w-1/2 rounded-full" />
          <span className="sk h-3.5 w-11/12 rounded-full" />
          {[0, 1, 2].map((i) => <span key={i} className="sk h-14 rounded-[14px]" />)}
        </div>
        <div className="sk h-72 flex-[1_1_280px] rounded-lg" />
      </div>
      {slow && (
        <p role="status" className="text-[13px] text-ink-3">
          Waking the engine. The first request after a quiet spell takes up to a minute.
        </p>
      )}
    </div>
  );
}
