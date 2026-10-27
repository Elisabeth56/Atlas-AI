/**
 * A magnifier over the line QA flagged: the line and one neighbour each side at 2x, flagged line in critical.
 * Decorative (the finding below it carries the words), so it's hidden from screen readers. Once per screen.
 */
export function Loupe({
  lines,
  flagged,
  size = 180,
  className = "",
}: {
  lines: string[];
  /** 1-based line number of the finding */
  flagged: number;
  size?: number;
  className?: string;
}) {
  const shown = [flagged - 1, flagged, flagged + 1].filter((n) => n >= 1 && n <= lines.length);
  return (
    <div
      aria-hidden
      className={`absolute overflow-hidden rounded-full bg-critical-wash motion-safe:animate-[float_7s_ease-in-out_infinite] ${className}`}
      style={{
        width: size,
        height: size,
        boxShadow: "0 0 0 7px var(--surface-2), 0 0 0 8px var(--line), 0 24px 60px var(--drop)",
      }}
    >
      <div className="absolute top-1/2 left-3 -translate-y-1/2 font-mono text-[24px] leading-[46px] whitespace-pre">
        {shown.map((n) => (
          <div key={n} className={n === flagged ? "text-critical" : "text-ink-3/70"}>
            {lines[n - 1].trimStart()}
          </div>
        ))}
      </div>
    </div>
  );
}
