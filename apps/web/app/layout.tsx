import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// self-hosted from @fontsource so builds never depend on reaching Google Fonts
const hanken = localFont({
  src: [
    { path: "../node_modules/@fontsource/hanken-grotesk/files/hanken-grotesk-latin-400-normal.woff2", weight: "400" },
    { path: "../node_modules/@fontsource/hanken-grotesk/files/hanken-grotesk-latin-600-normal.woff2", weight: "600" },
  ],
  variable: "--font-hanken",
});
const jetbrains = localFont({
  src: "../node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2",
  variable: "--font-jetbrains",
});
// the hand face is only for grease-pencil marks and the word "you"
const caveat = localFont({
  src: "../node_modules/@fontsource/caveat-brush/files/caveat-brush-latin-400-normal.woff2",
  variable: "--font-caveat",
});

export const metadata: Metadata = {
  title: "Atlas",
  description: "Describe a pipeline in a sentence. Atlas writes the dbt models, SQL, tests and docs, grounded in your DataHub catalog.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`h-full ${hanken.variable} ${jetbrains.variable} ${caveat.variable}`}>
      <body className="flex min-h-full flex-col bg-surface-0 text-ink-2">{children}</body>
    </html>
  );
}
