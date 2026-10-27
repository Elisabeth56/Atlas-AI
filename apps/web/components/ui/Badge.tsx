export type Status = "pending" | "running" | "done" | "waiting" | "failed";

const tone: Record<Status, { dot: string; text: string; word: string }> = {
  pending: { dot: "bg-ink-3/30", text: "text-ink-3", word: "pending" },
  running: { dot: "bg-live motion-safe:animate-[breathe_1.6s_ease-in-out_infinite]", text: "text-ink-2", word: "running" },
  done: { dot: "bg-moss", text: "text-moss", word: "done" },
  waiting: { dot: "bg-amber ring-4 ring-amber/20", text: "text-amber", word: "waiting for you" },
  failed: { dot: "bg-critical", text: "text-critical", word: "failed" },
};

/** Status is always a dot plus a word, never colour alone. */
export function Badge({ status, label }: { status: Status; label?: string }) {
  const t = tone[status];
  return (
    <span className={`inline-flex items-center gap-2 rounded-full bg-surface-2 px-3 py-1 text-caption ${t.text}`}>
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${t.dot}`} />
      {label ?? t.word}
    </span>
  );
}
