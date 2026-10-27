/** A frame with four sprocket holes and a safelight point at its centre. */
export function Logo({ size = 24 }: { size?: number }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 22 22">
      <rect x="1" y="1" width="20" height="20" rx="6" fill="var(--moss-deep)" />
      <rect x="5" y="5" width="4" height="2" rx="1" fill="var(--surface-0)" />
      <rect x="13" y="5" width="4" height="2" rx="1" fill="var(--surface-0)" />
      <rect x="5" y="15" width="4" height="2" rx="1" fill="var(--surface-0)" />
      <rect x="13" y="15" width="4" height="2" rx="1" fill="var(--surface-0)" />
      <circle cx="11" cy="11" r="2.4" fill="var(--safelight)" />
    </svg>
  );
}
