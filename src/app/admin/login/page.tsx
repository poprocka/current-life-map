"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { btnPrimary, input } from "@/components/admin/ui";

/** Coach sign-in: email + password (or a one-time link), then authenticator-app MFA. There is no public sign-up. */
export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const sb = supabaseBrowser();
  if (!sb) return <main className="mx-auto max-w-[420px] px-6 py-24 text-[14px]">Sign-in isn’t configured on this deployment.</main>;
  return (
    <main className="mx-auto flex min-h-dvh max-w-[400px] flex-col justify-center px-6">
      <p className="eyebrow">Coach workspace</p>
      <h1 className="mt-3 font-serif text-[34px] font-light">Sign in</h1>
      <form className="mt-8 flex flex-col gap-3" onSubmit={async (e) => {
        e.preventDefault(); setMsg(null);
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) return setMsg("Those details didn’t work.");
        router.push("/admin/mfa");
      }}>
        <label className="text-[12px] text-taupe">Email<input className={`${input} mt-1 w-full`} type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
        <label className="text-[12px] text-taupe">Password<input className={`${input} mt-1 w-full`} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        <button className={`${btnPrimary} mt-2 py-2.5`} type="submit">Continue</button>
        <button type="button" className="text-[12px] text-taupe underline" onClick={async () => {
          if (!email) return setMsg("Enter your email first.");
          const { error } = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: `${location.origin}/admin/mfa` } });
          setMsg(error ? "We couldn’t send a sign-in link." : "If this email belongs to a coach, a sign-in link is on its way.");
        }}>Email me a sign-in link instead</button>
        {msg && <p role="status" className="text-[12.5px] text-burgundy">{msg}</p>}
      </form>
    </main>
  );
}
