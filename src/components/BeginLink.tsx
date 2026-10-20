"use client";
import Link from "next/link";
import { onBegin } from "@/lib/analytics";

/** Begin: starts a fresh Self-Interview (the note beside it: selecting Begin means agreeing to the privacy notice). Counted as a "begin" event. */
export function BeginLink({ className, children }: { className: string; children: React.ReactNode }) {
  return <Link href="/interview?new=1" onClick={() => onBegin()} className={className}>{children}</Link>;
}
