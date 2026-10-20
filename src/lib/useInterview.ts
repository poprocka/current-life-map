"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { track } from "@/lib/analytics";
import { readChannel } from "@/lib/channel";
import type { AnswerValue } from "@/content/types";
import { CONTENT_VERSION } from "@/content/v10/question-bank";
import { resumeStep, TOTAL_STEPS } from "@/engine/navigation";

const KEY = `clm:${CONTENT_VERSION}:session`;

export type SyncState = "idle" | "saving" | "saved" | "device" | "error";

interface Stored {
  version: string;
  answers: Record<string, AnswerValue>;
  step: number;
  token?: string;
  updatedAt: string;
}

export function readStored(): Stored | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Stored;
    return s.version === CONTENT_VERSION ? s : null;
  } catch {
    return null;
  }
}

function write(s: Stored) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable (private mode): in-memory only */
  }
}

export function clearStored() {
  try { localStorage.removeItem(KEY); } catch { /* noop */ }
}

/**
 * Interview state with autosave.
 * Every change is written to the device immediately, then synced to the server (debounced).
 * If server storage isn't configured, sync reports "device" honestly instead of "saved".
 */
export function useInterview() {
  const [ready, setReady] = useState(false);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [step, setStep] = useState(0);
  const [sync, setSync] = useState<SyncState>("idle");
  const token = useRef<string | undefined>(undefined);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const serverAvailable = useRef(true);

  useEffect(() => {
    const s = readStored();
    if (s) {
      setAnswers(s.answers);
      token.current = s.token;
      setStep(Math.min(s.step ?? resumeStep(s.answers), TOTAL_STEPS - 1));
    }
    setReady(true);
  }, []);

  // One save at a time: a save that starts while the previous one is still creating the record waits for it,
  // so two quick answers can never create two assessments.
  const inFlight = useRef<Promise<void> | null>(null);
  const pushToServer = useCallback(async (a: Record<string, AnswerValue>) => {
    const prev = inFlight.current;
    const run = (async () => { if (prev) await prev.catch(() => undefined); await pushOnce(a); })();
    inFlight.current = run;
    try { await run; } finally { if (inFlight.current === run) inFlight.current = null; }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const pushOnce = async (a: Record<string, AnswerValue>) => {
    if (!serverAvailable.current) return setSync("device");
    setSync("saving");
    try {
      if (!token.current) {
        // A private client link's token (kept from the URL fragment) is sent in the body, never in a URL.
        let invite: string | null = null;
        try { invite = localStorage.getItem("clm:v10:invite"); } catch { /* private mode */ }
        const ch = readChannel();
        const r = await fetch("/api/assessments", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...(invite ? { invite } : {}), ...(ch ? { source: ch.source, campaign: ch.campaign } : {}) }) });
        if (r.status === 503) { serverAvailable.current = false; return setSync("device"); }
        if (!r.ok) throw new Error();
        token.current = (await r.json()).token;
        track("interview_start", { entry: invite ? "client_link" : "public" });
        try { localStorage.removeItem("clm:v10:invite"); } catch { /* private mode */ }
      }
      // The access token travels in the body, never in the URL.
      const r = await fetch("/api/assessments/answers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.current, answers: a }),
      });
      if (r.status === 503) { serverAvailable.current = false; return setSync("device"); }
      if (!r.ok) throw new Error();
      setSync("saved");
    } catch {
      setSync("error");
    }
  };

  const persist = useCallback((a: Record<string, AnswerValue>, st: number) => {
    write({ version: CONTENT_VERSION, answers: a, step: st, token: token.current, updatedAt: new Date().toISOString() });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void pushToServer(a).then(() =>
        write({ version: CONTENT_VERSION, answers: a, step: st, token: token.current, updatedAt: new Date().toISOString() }));
    }, 600);
  }, [pushToServer]);

  const answer = useCallback((id: string, value: AnswerValue | undefined) => {
    setAnswers((prev) => {
      const next = { ...prev };
      if (value === undefined) delete next[id];
      else next[id] = value;
      persist(next, step);
      return next;
    });
  }, [persist, step]);

  const goTo = useCallback((st: number) => {
    const clamped = Math.max(0, Math.min(st, TOTAL_STEPS - 1));
    if (clamped > step) track("interview_progress", { step: clamped + 1, of: TOTAL_STEPS });
    setStep(clamped);
    setAnswers((a) => { persist(a, clamped); return a; });
  }, [persist, step]);

  return { ready, answers, step, sync, answer, goTo, token: token.current };
}
