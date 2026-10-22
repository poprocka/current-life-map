"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { DuplicateGroup } from "@/server/admin/types";
import { Badge, btn, btnPrimary, fmtDate } from "./ui";

const STAGE: Record<string, string> = { prospect: "Prospect", lead: "Lead", client: "Client" };
const groupKey = (g: DuplicateGroup) => `clm:dup:${g.clients.map((c) => c.client_id).sort().join(",")}`;

/**
 * System suggestion at the top of the overview (Jana, 22 Oct): client records that share an email. Nothing is merged
 * automatically — Jana chooses which record to keep and confirms. "Not the same person" hides that suggestion on this
 * device (it comes back if another record with the email appears).
 */
export function DuplicateClients({ groups }: { groups: DuplicateGroup[] }) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  useEffect(() => {
    try { setHidden(new Set(groups.map(groupKey).filter((k) => localStorage.getItem(k) === "1"))); } catch { /* private mode */ }
  }, [groups]);
  const visible = groups.filter((g) => !hidden.has(groupKey(g)));
  if (!visible.length) return null;
  const dismiss = (g: DuplicateGroup) => {
    try { localStorage.setItem(groupKey(g), "1"); } catch { /* private mode */ }
    setHidden((h) => new Set(h).add(groupKey(g)));
  };
  return (
    <section aria-labelledby="dup-h" className="rounded-[18px] border border-burgundy/35 bg-white/60 p-5">
      <h2 id="dup-h" className="text-[10.5px] uppercase tracking-[0.16em] text-burgundy">Suggested merge · same email on {visible.length === 1 ? "two records" : `${visible.length} sets of records`}</h2>
      <p className="mt-1.5 max-w-[720px] text-[12.5px] text-mahogany/75">
        These client records share an email, often because someone requested their PDF and later booked a call. Merge them only if they’re the same person. Nothing is deleted: Maps, sessions, notes and files move to the record you keep.
      </p>
      <ul className="mt-3 divide-y divide-linen-line">
        {visible.map((g) => <Group key={groupKey(g)} g={g} onDismiss={() => dismiss(g)} />)}
      </ul>
    </section>
  );
}

function Group({ g, onDismiss }: { g: DuplicateGroup; onDismiss: () => void }) {
  const router = useRouter();
  const [keep, setKeep] = useState(g.clients[0].client_id);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const kept = g.clients.find((c) => c.client_id === keep)!;
  const others = g.clients.filter((c) => c.client_id !== keep);
  const keptLabel = kept.name ?? kept.email ?? "this record";

  async function merge() {
    setBusy(true); setErr(null);
    try {
      for (const o of others) {
        const r = await fetch(`/api/admin/clients/${keep}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "merge", mergeId: o.client_id }) });
        if (!r.ok) throw new Error();
      }
      router.refresh();
    } catch { setErr("Couldn’t merge them. Please try again."); setBusy(false); setConfirming(false); router.refresh(); }
  }

  return (
    <li className="py-3.5 text-[12.5px]">
      <a href={`mailto:${g.email}`} className="text-mahogany underline decoration-linen-line underline-offset-4 hover:text-burgundy">{g.email}</a>
      <fieldset className="mt-2 space-y-1.5" disabled={busy}>
        <legend className="sr-only">Record to keep</legend>
        {g.clients.map((c) => (
          <label key={c.client_id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <input type="radio" name={`keep-${g.clients[0].client_id}`} checked={keep === c.client_id} onChange={() => { setKeep(c.client_id); setConfirming(false); }} className="accent-burgundy" />
            <span className={keep === c.client_id ? "text-mahogany" : "text-mahogany/75"}>{c.name ?? <i className="text-taupe">No name</i>}</span>
            <Badge v={c.stage} label={STAGE[c.stage]} />
            <span className="text-taupe">{c.maps} {c.maps === 1 ? "Map" : "Maps"}{c.sessions ? ` · ${c.sessions} ${c.sessions === 1 ? "session" : "sessions"}` : ""} · added {fmtDate(c.created_at)}</span>
            {keep === c.client_id && <span className="text-[10.5px] uppercase tracking-[0.12em] text-burgundy">Keep</span>}
            <Link href={`/admin/clients/${c.client_id}`} className="text-taupe underline decoration-linen-line underline-offset-4 hover:text-burgundy">Open</Link>
          </label>
        ))}
      </fieldset>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {confirming ? (
          <>
            <span className="text-mahogany/80">Merge {others.length === 1 ? "the other record" : `the other ${others.length} records`} into <b className="font-normal text-mahogany">{keptLabel}</b>?</span>
            <button type="button" className={btnPrimary} onClick={merge} disabled={busy}>{busy ? "Merging…" : "Yes, merge"}</button>
            <button type="button" className={btn} onClick={() => setConfirming(false)} disabled={busy}>Cancel</button>
          </>
        ) : (
          <>
            <button type="button" className={btnPrimary} onClick={() => setConfirming(true)}>Merge into {keptLabel}</button>
            <button type="button" className={btn} onClick={onDismiss}>Not the same person</button>
          </>
        )}
        {err && <span role="alert" className="text-burgundy">{err}</span>}
      </div>
    </li>
  );
}
