// Magic-link landing: swaps the one-time code for a session, then continues to where the user was going.
import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = request.nextUrl.searchParams.get("next") ?? "/new";
  if (code) {
    const supabase = await supabaseServer();
    await supabase.auth.exchangeCodeForSession(code);
  }
  // only same-site paths, so the link can't be turned into an open redirect
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/new";
  return NextResponse.redirect(new URL(safeNext, request.url));
}
