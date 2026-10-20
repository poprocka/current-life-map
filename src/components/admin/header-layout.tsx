/**
 * Shared by the server-rendered portal header and the client-side demo, so it carries no "use client" directive:
 * a server component can't call functions exported from a client module (navItemClass etc. are called, not rendered).
 */
import type { ReactNode } from "react";
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
