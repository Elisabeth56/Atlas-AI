import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Atlas AI — Autonomous Data Engineering",
  description:
    "Atlas AI plans, writes, tests and repairs production pipelines across your warehouse and lakehouse.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col bg-bg-base">{children}</body>
    </html>
  );
}
