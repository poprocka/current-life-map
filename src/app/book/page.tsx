"use client";
import { useEffect } from "react";

/**
 * Older PDF emails linked to /book#b=<one-time link>. The paid Deep Dive is replaced by 1:1 coaching applications
 * (21 Oct), so this forwards to the application, keeping the code in the fragment (never sent to a server or logs).
 */
export default function BookPage() {
  useEffect(() => { window.location.replace(`/apply${window.location.hash}`); }, []);
  return <main className="mx-auto flex min-h-dvh max-w-[520px] flex-col justify-center px-6"><p className="text-[14px] text-mahogany/75" aria-live="polite">One moment…</p></main>;
}
