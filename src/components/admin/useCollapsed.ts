"use client";
import { useEffect, useState } from "react";

/** Open/closed state of a portal panel, remembered on this device (Jana, 22 Oct). */
export function useOpen(key: string, initial = true) {
  const [open, setOpen] = useState(initial);
  useEffect(() => { try { const v = localStorage.getItem(`clm:panel:${key}`); if (v !== null) setOpen(v === "1"); } catch { /* private mode */ } }, [key]);
  const toggle = (next: boolean) => { setOpen(next); try { localStorage.setItem(`clm:panel:${key}`, next ? "1" : "0"); } catch { /* private mode */ } };
  return [open, toggle] as const;
}
