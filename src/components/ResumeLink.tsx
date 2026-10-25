"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { readStored } from "@/lib/useInterview";
import { isComplete } from "@/engine/navigation";

/**
 * Under the Begin button (Jana, 25 Oct): "Continue where you left off" (or "View your Current Life Map") when this
 * device has a Self-Interview in progress or finished; otherwise the estimated time (`fallback`) in the same place.
 */
export function ResumeLink({ fallback = null }: { fallback?: React.ReactNode }) {
  const [state, setState] = useState<"none" | "resume" | "done">("none");
  useEffect(() => {
    const s = readStored();
    if (!s || Object.keys(s.answers).length === 0) return;
    setState(isComplete(s.answers) ? "done" : "resume");
  }, []);
  if (state === "none") return <>{fallback}</>;
  return (
    <Link href={state === "done" ? "/results" : "/interview?resume=1"}
      className="text-[13px] text-taupe underline decoration-linen-line underline-offset-4 hover:text-burgundy">
      {state === "done" ? "View your Current Life Map" : "Continue where you left off"}
    </Link>
  );
}
