const guardrails = [
  { label: "Human review on finance_*", value: "Required" },
  { label: "Max warehouse size", value: "Large" },
  { label: "Monthly compute budget", value: "$68k" },
  { label: "Production write access", value: "Via PR only" },
  { label: "PII masking coverage", value: "100%" },
];

export function GuardrailsPanel() {
  return (
    <div className="card-atlas p-6">
      <h3 className="text-[17px] font-semibold text-text-heading">Guardrails</h3>
      <p className="mt-1 text-[13px] text-text-body">
        Policies currently enforced on every agent action
      </p>
      <div className="mt-5">
        {guardrails.map((g) => (
          <div
            key={g.label}
            className="flex items-center justify-between border-b border-border-hairline py-3.5 last:border-b-0"
          >
            <span className="text-[14px] text-text-body-strong">{g.label}</span>
            <span className="font-mono-atlas text-[13px] text-text-heading">{g.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
