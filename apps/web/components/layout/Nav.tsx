import Link from "next/link";

const links = [
  { label: "Platform", href: "/#platform" },
  { label: "Use cases", href: "/#use-cases" },
  { label: "How it works", href: "/#how-it-works" },
  { label: "New run", href: "/new" },
  { label: "Live agents", href: "/agents" },
  { label: "Dashboard", href: "/dashboard" },
];

export function Nav() {
  return (
    <header className="sticky top-0 z-50 border-b border-border-hairline bg-bg-base/85 backdrop-blur">
      <div className="mx-auto flex max-w-[1280px] items-center justify-between px-6 py-4 lg:px-10">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-sm font-bold text-white">
            A
          </span>
          <span className="text-[15px] font-semibold text-text-heading">
            Atlas <span className="text-accent">AI</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {links.map((l) => (
            <Link
              key={l.label}
              href={l.href}
              className="text-[14px] text-text-body transition-colors hover:text-text-heading"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-6">
          <Link
            href="/demo"
            className="hidden text-[14px] text-text-body transition-colors hover:text-text-heading sm:block"
          >
            Talk to us
          </Link>
          <Link href="/demo" className="btn-primary">
            Book a demo
          </Link>
        </div>
      </div>
    </header>
  );
}
