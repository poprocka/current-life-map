"use client";
import Link from "next/link";
import { agreeOnBegin } from "@/lib/analytics";

/** Begin: starts a fresh Self-Interview. Selecting it is the agreement the privacy note beside it describes. */
export function BeginLink({ className, children }: { className: string; children: React.ReactNode }) {
  return <Link href="/interview?new=1" onClick={() => agreeOnBegin()} className={className}>{children}</Link>;
}
