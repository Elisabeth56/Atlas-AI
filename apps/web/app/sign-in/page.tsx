"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

function SignInForm() {
  const router = useRouter();
  const next = useSearchParams().get("next") ?? "/new";
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "demo">("idle");
  const [error, setError] = useState<string | null>(null);
  const supabase = supabaseBrowser();

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setState("sending");
    setError(null);
    const redirect = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: redirect } });
    if (error) {
      setError(error.message);
      setState("idle");
    } else {
      setState("sent");
    }
  }

  async function tryDemo() {
    if (!supabase) return router.push(next);
    setState("demo");
    setError(null);
    const { error } = await supabase.auth.signInAnonymously();
    if (error) {
      setError("The demo couldn’t start. Try again in a moment.");
      setState("idle");
      return;
    }
    router.push(next);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#141311] px-4 text-[#EDEBE6]">
      <div className="w-full max-w-sm rounded-3xl bg-[#1C1B18] p-7 shadow-[inset_0_0_0_1px_rgba(237,235,230,0.06)]">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in to Atlas</h1>
        <p className="mt-2 text-sm text-[#B4B1AA]">We’ll email you a link. No password.</p>

        {state === "sent" ? (
          <p role="status" className="mt-6 rounded-2xl bg-[#26241F] p-4 text-sm">
            Check {email} for your sign-in link.
          </p>
        ) : (
          <form onSubmit={sendLink} className="mt-6 flex flex-col gap-3">
            <label htmlFor="email" className="text-sm text-[#B4B1AA]">Email</label>
            <input
              id="email" type="email" required autoComplete="email" value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12 rounded-2xl bg-[#141311] px-4 outline-none ring-1 ring-[rgba(237,235,230,0.1)] focus:ring-2 focus:ring-[#A3B072]"
            />
            <button type="submit" disabled={state === "sending"}
              className="h-12 rounded-full bg-[#CFDAA8] font-semibold text-[#20260F] disabled:opacity-50">
              {state === "sending" ? "Sending…" : "Email me a link"}
            </button>
          </form>
        )}

        <div className="mt-6 border-t border-[rgba(237,235,230,0.08)] pt-6">
          <button type="button" onClick={tryDemo} disabled={state === "demo"}
            className="h-12 w-full rounded-full bg-[#26241F] disabled:opacity-50">
            {state === "demo" ? "Starting the demo…" : "Try the demo without an account"}
          </button>
          <p className="mt-3 text-xs text-[#9C9A94]">You get a private workspace with a sample catalog.</p>
        </div>
        {error && <p role="alert" className="mt-4 text-sm text-[#E08A7A]">{error}</p>}
      </div>
    </main>
  );
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  );
}
