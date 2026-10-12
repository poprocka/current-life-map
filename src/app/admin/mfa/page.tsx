"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { btnPrimary, input } from "@/components/admin/ui";

/** Second factor (TOTP). First visit enrols an authenticator app; later visits verify a 6-digit code. */
export default function Mfa() {
  const router = useRouter();
  const sb = supabaseBrowser();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!sb) return;
    (async () => {
      const { data: u } = await sb.auth.getUser();
      if (!u.user) return router.replace("/admin/login");
      const { data: aal } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal?.currentLevel === "aal2") return router.replace("/admin");
      const { data: f } = await sb.auth.mfa.listFactors();
      const totp = f?.totp?.find((x) => x.status === "verified");
      if (totp) return setFactorId(totp.id);
      const { data: en, error } = await sb.auth.mfa.enroll({ factorType: "totp", friendlyName: `Coach ${new Date().toISOString().slice(0, 10)}` });
      if (error || !en) return setMsg("Couldn’t start authenticator setup.");
      setFactorId(en.id); setQr(en.totp.qr_code);
    })();
  }, [sb, router]);

  if (!sb) return <main className="mx-auto max-w-[420px] px-6 py-24 text-[14px]">Sign-in isn’t configured on this deployment.</main>;
  return (
    <main className="mx-auto flex min-h-dvh max-w-[400px] flex-col justify-center px-6">
      <p className="eyebrow">Two-step verification</p>
      <h1 className="mt-3 font-serif text-[34px] font-light">{qr ? "Set up your authenticator" : "Enter your code"}</h1>
      {qr && <><p className="mt-3 text-[13px] text-mahogany/75">Scan this with an authenticator app (1Password, Google Authenticator, Authy), then enter the 6-digit code.</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qr} alt="Authenticator QR code" className="mt-4 h-44 w-44 rounded-lg bg-white p-2" /></>}
      <form className="mt-6 flex flex-col gap-3" onSubmit={async (e) => {
        e.preventDefault(); setMsg(null);
        if (!factorId) return;
        const { error } = await sb.auth.mfa.challengeAndVerify({ factorId, code: code.trim() });
        if (error) return setMsg("That code didn’t match. Try the newest one.");
        router.replace("/admin"); router.refresh();
      }}>
        <input className={`${input} text-center font-mono text-[20px] tracking-[0.3em]`} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} aria-label="6-digit code" />
        <button className={`${btnPrimary} py-2.5`} type="submit" disabled={!factorId || code.trim().length !== 6}>Verify</button>
        {msg && <p role="status" className="text-[12.5px] text-burgundy">{msg}</p>}
      </form>
    </main>
  );
}
