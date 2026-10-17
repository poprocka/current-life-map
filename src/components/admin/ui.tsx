"use client";
import type { ReactNode } from "react";

export const fmtDate = (s: string | null | undefined, tz?: string | null) => {
  if (!s) return "—";
  try {
    return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", ...(tz ? { timeZone: tz } : {}) }).format(new Date(s));
  } catch { return s; }
};
export const shortId = (id: string) => id.slice(0, 8);

const TONE: Record<string, string> = {
  confirmed: "bg-[#E6EFE3] text-[#3E5A36]", paid: "bg-[#E6EFE3] text-[#3E5A36]", delivered: "bg-[#E6EFE3] text-[#3E5A36]", sent: "bg-[#EEF2EA] text-[#4D6145]",
  ready: "bg-[#EEF2EA] text-[#4D6145]", reviewed: "bg-[#E6EFE3] text-[#3E5A36]", completed: "bg-[#EEF2EA] text-[#4D6145]", done: "bg-[#E6EFE3] text-[#3E5A36]",
  pending: "bg-[#F6ECD9] text-[#8A6420]", queued: "bg-[#F6ECD9] text-[#8A6420]", in_review: "bg-[#F6ECD9] text-[#8A6420]", planned: "bg-[#F6ECD9] text-[#8A6420]",
  unknown: "bg-[#F6ECD9] text-[#8A6420]", in_progress: "bg-[#F6ECD9] text-[#8A6420]", rescheduled: "bg-[#ECE7F0] text-[#5E4C6E]",
  cancelled: "bg-[#F3E2E2] text-[#7A2E2E]", failed: "bg-[#F3E2E2] text-[#7A2E2E]", bounced: "bg-[#F3E2E2] text-[#7A2E2E]", no_show: "bg-[#F3E2E2] text-[#7A2E2E]",
  refunded: "bg-[#ECE7F0] text-[#5E4C6E]", unreviewed: "bg-linen-deep text-taupe",
};
export function Badge({ v, label }: { v: string | null | undefined; label?: string }) {
  if (!v) return <span className="text-taupe/70">—</span>;
  return <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[10.5px] ${TONE[v] ?? "bg-linen-deep text-mahogany/80"}`}>{label ?? v.replace(/_/g, " ")}</span>;
}

export function Card({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="rounded-[18px] border hairline bg-white/40 p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-[10.5px] uppercase tracking-[0.16em] text-burgundy">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function DemoBanner() {
  return (
    <div role="note" className="bg-[#F6ECD9] px-4 py-2 text-center text-[11.5px] text-[#6E4F18]">
      Demo workspace with invented sample data. Not connected to a database. Nothing you change here is saved.
    </div>
  );
}

export const btn = "rounded-full border border-linen-line px-3.5 py-1.5 text-[11px] uppercase tracking-[0.12em] text-mahogany transition hover:border-burgundy hover:text-burgundy disabled:opacity-50";
export const btnPrimary = "rounded-full bg-burgundy px-4 py-1.5 text-[11px] uppercase tracking-[0.12em] text-linen transition hover:bg-mahogany disabled:opacity-50";
export const input = "rounded-lg border border-linen-line bg-white/70 px-3 py-1.5 text-[12.5px] focus:border-burgundy focus:outline-none";

/**
 * Coach portal header, shared by the live portal and the demo. Phone: brand + account on one row, then the two sections
 * as full-width tabs (44px tap targets). Tablet and up: one row.
 */
export function AdminHeaderLayout({ home, links, account }: { home: ReactNode; links: ReactNode; account: ReactNode }) {
  return (
    <header className="border-b hairline px-4 py-3 sm:px-10 sm:py-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="min-w-0 flex-1 sm:flex-none">{home}</div>
        <nav aria-label="Coach workspace" className="order-3 flex w-full gap-2 sm:order-2 sm:w-auto sm:gap-4">{links}</nav>
        <div className="order-2 ml-auto flex items-center gap-3 text-[12px] text-taupe sm:order-3">{account}</div>
      </div>
    </header>
  );
}
export const brandClass = "font-serif text-[18px] leading-tight sm:text-[20px]";
export const brandSuffix = "hidden text-[11px] uppercase tracking-[0.16em] text-taupe md:inline";
export const navItemClass = (active: boolean) =>
  `flex min-h-[44px] flex-1 items-center justify-center rounded-full border text-[11px] uppercase tracking-[0.14em] sm:min-h-0 sm:flex-none sm:rounded-none sm:border-0 sm:border-b sm:pb-0.5 ${
    active ? "border-burgundy bg-burgundy text-linen sm:bg-transparent sm:text-burgundy" : "border-linen-line text-taupe hover:text-burgundy sm:border-transparent"}`;
