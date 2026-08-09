"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createRequest } from "@/lib/api";
import { DEMO_PROMPT } from "@/lib/pipeline";

export function NewRunButton({ label = "Start new run" }: { label?: string }) {
  const router = useRouter();
  const [starting, setStarting] = useState(false);

  async function handleClick() {
    setStarting(true);
    try {
      const { request_id } = await createRequest(DEMO_PROMPT);
      router.push(`/agents/${request_id}?prompt=${encodeURIComponent(DEMO_PROMPT)}`);
    } catch {
      setStarting(false);
    }
  }

  return (
    <button onClick={handleClick} disabled={starting} className="btn-primary disabled:opacity-70">
      <Plus className="h-4 w-4" />
      {starting ? "Starting…" : label}
    </button>
  );
}

