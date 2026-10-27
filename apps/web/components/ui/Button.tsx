import { type ComponentProps, forwardRef } from "react";

type Variant = "primary" | "secondary" | "quiet" | "suggest";

const variants: Record<Variant, string> = {
  // one primary per view: the action Atlas wants next
  primary: "bg-safelight text-action-ink font-semibold hover:brightness-105",
  secondary: "bg-surface-2 text-ink hover:brightness-110",
  quiet: "text-ink-2 hover:text-ink",
  // a fix Atlas can apply itself, e.g. "Use md5(card_last4)"
  suggest: "text-suggest shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--suggest)_35%,transparent)] hover:bg-surface-2",
};

/** Button looks for elements that aren't buttons, like a Link that navigates. */
export function buttonStyles(variant: Variant = "primary", size: "sm" | "md" | "lg" = "md") {
  return `inline-flex items-center justify-center gap-2 rounded-full px-5 text-[15px] transition-[filter,color,opacity] duration-200 ease-ui disabled:pointer-events-none disabled:opacity-40 ${
    size === "lg" ? "h-12" : size === "sm" ? "h-9 px-3.5 text-[13px]" : "h-11"
  } ${variants[variant]}`;
}

interface ButtonProps extends ComponentProps<"button"> {
  variant?: Variant;
  size?: "sm" | "md" | "lg";
  /** Why the button is disabled, written beside it rather than hidden in a tooltip. */
  disabledReason?: string;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", disabledReason, className = "", children, ...props },
  ref,
) {
  const button = (
    <button
      ref={ref}
      className={`${buttonStyles(variant, size)} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
  if (!props.disabled || !disabledReason) return button;
  return (
    <span className="inline-flex flex-wrap items-center gap-3">
      {button}
      <span className="text-small text-ink-3">{disabledReason}</span>
    </span>
  );
});
