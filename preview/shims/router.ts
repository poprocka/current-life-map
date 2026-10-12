// In-memory router for the single-page preview (replaces Next routing).
import { useEffect, useState } from "react";
let path = "/";
const subs = new Set<() => void>();
export function navigate(to: string) { path = to; subs.forEach((f) => f()); try { window.scrollTo(0, 0); } catch {} }
export function usePath() {
  const [, set] = useState(0);
  useEffect(() => { const f = () => set((n) => n + 1); subs.add(f); return () => { subs.delete(f); }; }, []);
  return path;
}
