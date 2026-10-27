const WORDS = ["ATLAS 400", "SAMPLE CATALOG", "GROUNDED IN DATAHUB", "CHECKED BY CODE", "WRITTEN IN DBT"];
const FRAMES = ["14A", "15", "15A", "16", "16A", "17", "17A", "18", "18A", "19"];
const HOLES = Array.from({ length: 90 });

/** The film edge the page opens on: sprocket holes and frame numbers drifting past. Decoration, so hidden from readers. */
export function EdgePrint() {
  const run = FRAMES.map((f, i) => `${WORDS[i % WORDS.length]} ▸ ${f}`);
  return (
    <div aria-hidden className="flex h-[30px] flex-col justify-between overflow-hidden bg-film py-1">
      <div className="flex gap-2.5 pl-1.5">
        {HOLES.map((_, i) => (
          <span key={i} className="h-[5px] w-2.5 shrink-0 rounded-[2px] bg-[#1e1d1a]" />
        ))}
      </div>
      <div className="flex w-max gap-7 font-mono text-[9px] tracking-[0.18em] whitespace-nowrap text-ink-3 motion-safe:animate-[tick_70s_linear_infinite]">
        {[...run, ...run].map((t, i) => (
          <span key={i}>{t}</span>
        ))}
      </div>
    </div>
  );
}
