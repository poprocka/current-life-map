import React from "react";
import { createRoot } from "react-dom/client";
import { navigate, usePath } from "./shims/router";
import Introduction from "@/app/page";
import InterviewPage from "@/app/interview/page";
import Results from "@/app/results/page";
import Privacy from "@/app/privacy/page";
import Apply from "@/app/apply/page";
import { ACTIVE_QUESTIONS } from "@/content/v10/question-bank";
import { AdminDemo } from "./admin-demo";

// No server in the preview: storage routes answer "not configured", so the UI says "Saved on this device".
const realFetch = window.fetch.bind(window);
// The coaching application answers "received" (no Calendly in the preview), so the whole form can be tried.
window.fetch = (input: any, init?: any) =>
  String(input) === "/api/coaching/apply" ? Promise.resolve(new Response('{"received":true,"schedulingUrl":null}', { status: 200 }))
  : String(input).startsWith("/api/") ? Promise.resolve(new Response('{"error":"storage_not_configured"}', { status: 503 })) : realFetch(input, init);

const KEY = "clm:v10:session";
function sampleAnswers() {
  const a: Record<string, string> = {}; let i = 0;
  const truth = ["3", "2", "4", "1", "3", "2", "3"];
  const imp: Record<string, string> = { mind: "3", body: "4", restoration: "4", growth: "3", love: "1", social: "4", resources: "2", joy: "2" };
  const en: Record<string, string> = { mind: "-1", body: "0", restoration: "-2", growth: "1", love: "0", social: "-1", resources: "0", joy: "2" };
  for (const q of ACTIVE_QUESTIONS) {
    if (q.responseType === "importance") a[q.id] = imp[q.chapterId];
    else if (q.responseType === "energy") a[q.id] = en[q.chapterId];
    else if (q.responseType === "truth") a[q.id] = q.chapterId === "restoration" ? "1" : truth[i++ % 7];
  }
  const feelings: Record<string, number[]> = { mind: [0, 8], body: [1, 2], restoration: [10, 11, 7], growth: [1, 5], love: [5], social: [9, 10], resources: [0, 6], joy: [0, 4] };
  const em: Record<string, string[]> = {};
  for (const q of ACTIVE_QUESTIONS) if (q.responseType === "emotional_state") em[q.id] = feelings[q.chapterId].map((k) => q.options[k].value);
  return { ...a, ...em, "interconnections.01": "social", "interconnections.02": "joy", "interconnections.03": "restoration",
    "interconnections.04": "restoration", "interconnections.05": "growth", "interconnections.06": "resources", "interconnections.07": "somewhat_compete" };
}

function PreviewBar() {
  const btn = "underline underline-offset-4 hover:text-burgundy";
  return (
    <div className="fixed bottom-3 right-3 z-50 flex items-center gap-3 rounded-full border border-linen-line bg-linen/95 px-4 py-2 text-[11px] text-taupe shadow-sm"
      style={{ marginBottom: "env(safe-area-inset-bottom, 0px)" }}>
      <span className="uppercase tracking-[0.14em]">Preview</span>
      <button className={btn} onClick={() => { try { localStorage.removeItem(KEY); localStorage.removeItem("clm:v10:postmap"); } catch {} navigate("/"); location.reload(); }}>Restart</button>
      <button className={btn} onClick={() => {
        try { localStorage.setItem(KEY, JSON.stringify({ version: "v10", answers: sampleAnswers(), step: ACTIVE_QUESTIONS.length - 1, updatedAt: new Date().toISOString() })); } catch {}
        navigate("/results");
      }}>Sample results</button>
      <button className={btn} onClick={() => navigate("/admin")}>Coach workspace (demo)</button>
    </div>
  );
}

function App() {
  const full = usePath();
  const p = full.split("?")[0];
  if (p.startsWith("/admin")) return <><AdminDemo path={p} /><PreviewBar /></>;
  const Page = p === "/interview" ? InterviewPage : p === "/results" ? Results : p === "/privacy" ? Privacy : p === "/apply" ? Apply : Introduction;
  return <><Page key={full} /><PreviewBar /></>;
}
createRoot(document.getElementById("root")!).render(<App />);
