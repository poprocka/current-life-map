/** Isomorphic helpers for frozen result snapshots (browser + server). */
export function stableStringify(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`).join(",")}}`;
}

/** SHA-256 of the canonical snapshot: the same value appears in the PDF footer and the CMS, proving they match. */
export async function snapshotFingerprint(snapshot: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(stableStringify(snapshot));
  const d = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
