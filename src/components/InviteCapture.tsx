"use client";
import { useEffect, useState } from "react";

/**
 * Private client links look like https://…/#invite=<token>. The fragment never reaches the server or its logs.
 * We keep the token on this device until the Self-Interview starts, then send it once in the request body,
 * and remove it from the address bar straight away.
 */
export function InviteCapture() {
  const [invited, setInvited] = useState(false);
  useEffect(() => {
    const m = /(?:^#|&)invite=([A-Za-z0-9_-]{24,64})/.exec(window.location.hash);
    if (!m) return;
    try { localStorage.setItem("clm:v10:invite", m[1]); } catch { /* private mode: the Map stays anonymous */ }
    history.replaceState(null, "", window.location.pathname + window.location.search);
    setInvited(true);
  }, []);
  return invited ? (
    <p role="status" className="mt-6 rounded-[14px] bg-white/50 px-4 py-3 text-[12.5px] leading-relaxed text-mahogany/80">
      This is your personal link from Jana. When you complete the Self-Interview, your Map will be shared with her as part of your coaching.
    </p>
  ) : null;
}
