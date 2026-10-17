import Link from "next/link";
import { SignOut } from "./connected";
import { AdminHeaderLayout, brandClass, brandSuffix, navItemClass } from "./ui";

export function AdminHeader({ email, role, active }: { email: string | null; role: string; active?: "assessments" | "clients" }) {
  return (
    <AdminHeaderLayout
      home={<Link href="/admin" className={brandClass}>The Current Life Map <span className={brandSuffix}>· Coach workspace</span></Link>}
      links={<>
        <Link href="/admin" className={navItemClass(active === "assessments")} aria-current={active === "assessments" ? "page" : undefined}>Assessments</Link>
        <Link href="/admin/clients" className={navItemClass(active === "clients")} aria-current={active === "clients" ? "page" : undefined}>Clients</Link>
      </>}
      account={<><span className="hidden lg:inline">{email} · {role}</span><SignOut /></>}
    />
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
