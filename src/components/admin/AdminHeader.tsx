import Link from "next/link";
import { SignOut } from "./connected";

export function AdminHeader({ email, role }: { email: string | null; role: string }) {
  return (
    <header className="flex items-center justify-between border-b hairline px-6 py-4 sm:px-10">
      <Link href="/admin" className="font-serif text-[20px]">The Current Life Map <span className="text-[11px] uppercase tracking-[0.16em] text-taupe">· Coach workspace</span></Link>
      <span className="flex items-center gap-4 text-[12px] text-taupe">{email} · {role}<SignOut /></span>
    </header>
  );
}

export function NotConfigured({ what }: { what: "config" | "coach" }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[560px] flex-col justify-center px-6">
      <p className="eyebrow">Coach workspace</p>
      {what === "config" ? (
        <><h1 className="mt-3 font-serif text-[32px] font-light">Not connected yet</h1>
          <p className="mt-3 text-[14px] text-mahogany/75">The database and sign-in aren’t configured on this deployment. See docs/04-environment-setup.md.</p></>
      ) : (
        <><h1 className="mt-3 font-serif text-[32px] font-light">No access</h1>
          <p className="mt-3 text-[14px] text-mahogany/75">This account isn’t a coach. Ask an administrator to add it.</p></>
      )}
    </main>
  );
}
