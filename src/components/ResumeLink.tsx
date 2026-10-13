"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { readStored } from "@/lib/useInterview";
import { isComplete } from "@/engine/navigation";

/** Shown only when this device has a Self-Interview in progress or finished. */
export function ResumeLink() {
  const [state, setState] = useState<"none" | "resume" | "done">("none");
  useEffect(() => {
    const s = readStored();
    if (!s || Object.keys(s.answers).length === 0) return;
    setState(isComplete(s.answers) ? "done" : "resume");
  }, []);
  if (state === "none") return null;
  return (
    <Link href={state === "done" ? "/results" : "/interview?resume=1"}
      className="text-[13px] text-taupe underline decoration-linen-line underline-offset-4 hover:text-burgundy">
      {state === "done" ? "View your Current Life Map" : "Continue where you left off"}
    </Link>
  );
}
