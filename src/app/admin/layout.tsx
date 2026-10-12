import type { Metadata } from "next";

export const metadata: Metadata = { title: "Coach workspace · The Current Life Map", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-linen">{children}</div>;
}
