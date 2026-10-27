"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Develop, words } from "@/components/ui/Develop";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { Finding } from "@/components/ui/Finding";
import { GreasePencil } from "@/components/ui/GreasePencil";
import { Loupe } from "@/components/ui/Loupe";

const STG = [
  "with source as (",
  "    select * from {{ source('raw', 'stripe_payments') }}",
  ")",
  "",
  "select",
  "    payment_id,",
  "    customer_id,",
  "    amount_cents / 100.0 as amount_usd,",
  "    currency,",
  "    card_last4,",
  "    created_at",
  "from source",
];

/** The base components in one place, in both themes. Not linked from the app. */
export default function Kit() {
  const [take, setTake] = useState(0);
  const [light, setLight] = useState(false);

  return (
    <main data-theme={light ? "light" : undefined} className="min-h-screen bg-surface-0 px-4 py-16 sm:px-12">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-16">
        <header className="flex flex-wrap items-end justify-between gap-6">
          <div className="flex flex-col gap-3">
            <Eyebrow>atlas · base components</Eyebrow>
            <h1 className="text-title text-ink">
              <Develop key={take} inline items={words("Files develop as each agent finishes.")} />
            </h1>
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setLight((v) => !v)}>
              {light ? "Dark" : "Light"} theme
            </Button>
            <Button onClick={() => setTake((t) => t + 1)}>Develop again</Button>
          </div>
        </header>

        <section className="flex flex-col gap-4">
          <h2 className="text-heading text-ink">Buttons</h2>
          <div className="flex flex-wrap items-center gap-3">
            <Button>Use these sources</Button>
            <Button variant="secondary">Start fresh</Button>
            <Button variant="quiet">View lineage</Button>
            <Button disabled disabledReason="Fix the critical finding first.">Approve writeback</Button>
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-heading text-ink">Status</h2>
          <div className="flex flex-wrap gap-3">
            <Badge status="pending" />
            <Badge status="running" />
            <Badge status="done" />
            <Badge status="waiting" />
            <Badge status="failed" />
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-heading text-ink">Checkpoint mark</h2>
          <div data-theme="dark" className="flex items-center gap-10 rounded-lg bg-film p-8">
            <span className="text-caption text-ink-3">plan</span>
            <span className="text-caption text-ink-3">match</span>
            <GreasePencil key={take}>
              <span className="text-grease text-moss">you</span>
            </GreasePencil>
            <span className="text-caption text-ink-3">build</span>
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-heading text-ink">QA findings</h2>
          <div className="relative overflow-hidden rounded-lg bg-surface-1 hairline">
            <p className="px-6 pt-5 text-caption text-ink-3">models/staging/stg_stripe_payments.sql</p>
            <pre className="overflow-x-auto py-4 text-code text-ink-2">
              <Develop
                key={take}
                items={STG.map((line, i) => (
                  <span key={i} className={`block w-max min-w-full px-6 ${i === 9 ? "bg-critical-wash text-critical" : ""}`}>
                    <span className="inline-block w-8 text-ink-3/60">{i + 1}</span>
                    {line}
                  </span>
                ))}
              />
            </pre>
            <Loupe lines={STG} flagged={10} className="top-16 right-8 hidden md:block" />
            <div className="flex flex-col gap-2 p-6 pt-0">
              <Finding
                severity="critical"
                name="PII stays masked"
                action={<Button variant="suggest" size="sm">Use md5(card_last4)</Button>}
              >
                <code>card_last4</code> reaches <code>stg_stripe_payments</code>’s output unmasked (line 10).
              </Finding>
              <Finding severity="warning" name="SQL parses">
                <code>revenue_by_day.sql</code> uses Jinja Atlas can’t render, so it wasn’t checked.
              </Finding>
              <Finding severity="passed">3 more checks: columns resolve, keys tested, metadata complete.</Finding>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
