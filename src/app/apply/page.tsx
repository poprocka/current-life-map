"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { readStored } from "@/lib/useInterview";
import { track } from "@/lib/analytics";
import { COACHING_FORM } from "@/content/coaching";
import { CONTACT_EMAIL } from "@/content/contact";

/**
 * 1:1 coaching application (Jana, 21 Oct): name, email, optional message → saved → Calendly for a complimentary
 * 30-minute introductory conversation.
 *
 * - From the results page, this device's private results token links the application to the Self-Interview. From the PDF
 *   email (/apply#b=…), the one-time link does the same. Both go in the request body only; the #b code is removed from
 *   the address bar at once.
 * - The draft and the request id are kept for this tab (sessionStorage), so a failed submission loses nothing and a
 *   second tap or a retry can't create a second application.
 * - Submitting is not booking: after it's saved, the person goes to Calendly to choose a time, and can come back here
 *   to the same scheduling link if they left without choosing one.
 */
const DRAFT = "clm:coaching:draft";
const DONE = "clm:coaching:done";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Draft = { name: string; email: string; message: string; requestId: string; b?: string };
type Done = { name: string; url: string | null };
type Phase = { kind: "form" } | { kind: "sending" } | { kind: "error"; message: string } | { kind: "done"; done: Done };

const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) => (Number(c) ^ (Math.random() * 16) >> (Number(c) / 4)).toString(16)));
const load = <T,>(k: string): T | null => { try { const v = sessionStorage.getItem(k); return v ? (JSON.parse(v) as T) : null; } catch { return null; } };
const save = (k: string, v: unknown) => { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };

export default function ApplyPage() {
  const [draft, setDraft] = useState<Draft>({ name: "", email: "", message: "", requestId: "" });
  const [phase, setPhase] = useState<Phase>({ kind: "form" });
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});
  const [hasMap, setHasMap] = useState(false);
  const website = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const b = new URLSearchParams(window.location.hash.slice(1)).get("b") ?? undefined;
    if (window.location.hash) history.replaceState(null, "", window.location.pathname);
    setHasMap(!!readStored()?.token);
    const done = load<Done>(DONE);
    if (done) { setPhase({ kind: "done", done }); return; }
    const d = load<Draft>(DRAFT);
    setDraft({ name: d?.name ?? "", email: d?.email ?? "", message: d?.message ?? "", requestId: d?.requestId || newId(), b: b ?? d?.b });
  }, []);

  const update = (patch: Partial<Draft>) => {
    setDraft((d) => { const next = { ...d, ...patch }; save(DRAFT, next); return next; });
    if (phase.kind === "error") setPhase({ kind: "form" });
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (phase.kind === "sending") return;
    const errs: typeof errors = {};
    if (!draft.name.trim()) errs.name = "Please enter your name.";
    if (!EMAIL_RE.test(draft.email.trim())) errs.email = "Enter a valid email address, like name@example.com.";
    setErrors(errs);
    if (errs.name || errs.email) { document.getElementById(errs.name ? "apply-name" : "apply-email")?.focus(); return; }

    setPhase({ kind: "sending" });
    try {
      const r = await fetch("/api/coaching/apply", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: draft.requestId, name: draft.name.trim(), email: draft.email.trim(), message: draft.message,
          token: readStored()?.token, b: draft.b, website: website.current?.value ?? "",
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.received) {
        const done: Done = { name: draft.name.trim().split(/\s+/)[0], url: typeof j.schedulingUrl === "string" ? j.schedulingUrl : null };
        save(DONE, done);
        try { sessionStorage.removeItem(DRAFT); } catch { /* private mode */ }
        track("coaching_apply");
        setPhase({ kind: "done", done });
        if (done.url) { track("booking_open", { from: draft.b ? "email" : "results" }); setTimeout(() => window.location.assign(done.url!), 1200); }
        return;
      }
      if (r.status === 400) {
        const field = j.error === "invalid_email" ? "email" : j.error === "invalid_name" ? "name" : null;
        if (field) setErrors({ [field]: field === "email" ? "Enter a valid email address, like name@example.com." : "Please enter your name." });
        return setPhase({ kind: "error", message: "Please check the details above and try again." });
      }
      setPhase({ kind: "error", message: r.status === 503
        ? "Applications can't be received just now. Your details are kept on this page; please try again a little later."
        : "We couldn't send your application just now. Your details are kept on this page; please try again in a moment." });
    } catch {
      setPhase({ kind: "error", message: "We couldn't reach the server. Check your connection and try again; your details are kept on this page." });
    }
  }

  const field = "w-full rounded-[16px] border border-linen-line bg-linen/60 px-4 py-3 text-[16px] placeholder:text-taupe/70 focus:border-burgundy focus:outline-none sm:text-[14.5px]";
  const label = "block text-[13px] text-mahogany";

  return (
    <main className="mx-auto min-h-dvh max-w-[600px] px-6 pb-20 pt-12 sm:pt-16">
      <Link href={hasMap ? "/results" : "/"} className="eyebrow hover:text-burgundy">← {hasMap ? "Your Current Life Map" : "The Self-Interview"}</Link>

      {phase.kind === "done" ? (
        <section className="mt-12" aria-live="polite">
          <p className="eyebrow">{COACHING_FORM.eyebrow}</p>
          <h1 className="mt-3 font-serif text-[36px] font-light leading-tight sm:text-[42px]">Thank you{phase.done.name ? `, ${phase.done.name}` : ""}.</h1>
          {phase.done.url ? (
            <>
              <p className="mt-4 text-[14.5px] leading-relaxed text-mahogany/80">
                Your application is received. Next, choose a time for our complimentary 30-minute conversation.
              </p>
              <a href={phase.done.url} className="mt-7 inline-block rounded-full bg-burgundy px-7 py-3 text-[12px] uppercase tracking-[0.16em] text-linen transition hover:bg-mahogany">
                Choose a time
              </a>
              <p className="mt-5 text-[12.5px] leading-relaxed text-taupe">
                Your conversation is booked once you pick a time and see Calendly&rsquo;s confirmation. If you left without choosing one, you can use the button above.
              </p>
            </>
          ) : (
            <p className="mt-4 text-[14.5px] leading-relaxed text-mahogany/80">
              Your application is received. Online scheduling isn&rsquo;t open just yet, so Jana will email you to arrange a time for our complimentary conversation.
              You can also write to <a className="underline underline-offset-4" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
            </p>
          )}
        </section>
      ) : (
        <section className="mt-12">
          <p className="eyebrow">{COACHING_FORM.eyebrow}</p>
          <h1 className="mt-3 font-serif text-[36px] font-light leading-tight sm:text-[42px]">{COACHING_FORM.title}</h1>
          <p className="mt-3 text-[14.5px] leading-relaxed text-mahogany/80">{COACHING_FORM.intro}</p>

          <form onSubmit={submit} noValidate className="mt-9 space-y-6">
            <div>
              <label htmlFor="apply-name" className={label}>{COACHING_FORM.nameLabel}</label>
              <input id="apply-name" name="name" autoComplete="name" required maxLength={120} value={draft.name}
                aria-invalid={!!errors.name} aria-describedby={errors.name ? "apply-name-err" : undefined}
                onChange={(e) => { update({ name: e.target.value }); if (errors.name) setErrors((x) => ({ ...x, name: undefined })); }}
                className={`mt-2 ${field}`} />
              {errors.name && <p id="apply-name-err" className="mt-1.5 text-[12.5px] text-burgundy">{errors.name}</p>}
            </div>
            <div>
              <label htmlFor="apply-email" className={label}>{COACHING_FORM.emailLabel}</label>
              <input id="apply-email" name="email" type="email" autoComplete="email" inputMode="email" required maxLength={254} value={draft.email}
                aria-invalid={!!errors.email} aria-describedby={errors.email ? "apply-email-err" : undefined}
                onChange={(e) => { update({ email: e.target.value }); if (errors.email) setErrors((x) => ({ ...x, email: undefined })); }}
                className={`mt-2 ${field}`} />
              {errors.email && <p id="apply-email-err" className="mt-1.5 text-[12.5px] text-burgundy">{errors.email}</p>}
            </div>
            <div>
              <label htmlFor="apply-message" className={label}>{COACHING_FORM.messageLabel}</label>
              <textarea id="apply-message" name="message" rows={5} maxLength={4000} value={draft.message}
                placeholder={COACHING_FORM.messagePlaceholder}
                onChange={(e) => update({ message: e.target.value })}
                className={`mt-2 resize-y ${field}`} />
            </div>
            {/* Hidden from people; automated form-fillers tend to complete it */}
            <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
              <label htmlFor="apply-website">Website</label>
              <input id="apply-website" ref={website} tabIndex={-1} autoComplete="off" />
            </div>

            <div className="pt-2">
              <button type="submit" disabled={phase.kind === "sending"}
                className="w-full rounded-full bg-burgundy px-7 py-3.5 text-[12px] uppercase tracking-[0.16em] text-linen transition hover:bg-mahogany disabled:opacity-60 sm:w-auto">
                {phase.kind === "sending" ? "Sending…" : COACHING_FORM.submit}
              </button>
              <p role="status" aria-live="polite" className="mt-3 min-h-[20px] text-[12.5px] text-burgundy">{phase.kind === "error" ? phase.message : ""}</p>
            </div>
          </form>

          <p className="mt-6 border-t hairline pt-5 text-[12px] leading-relaxed text-taupe">
            Your details are used only to review your application and arrange our conversation. They aren&rsquo;t added to a mailing list.
            See the <Link href="/privacy" className="underline underline-offset-4 hover:text-burgundy">Privacy &amp; Data Use Notice</Link>.
          </p>
        </section>
      )}
    </main>
  );
}
