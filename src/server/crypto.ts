import "server-only";
export { stableStringify } from "@/lib/stable";
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";

export const sha256 = (s: string | Uint8Array) => createHash("sha256").update(s).digest("hex");
export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");


export function safeEqual(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export const hmacHex = (key: string, data: string) => createHmac("sha256", key).update(data).digest("hex");
export const hmacB64 = (key: string | Buffer, data: string) => createHmac("sha256", key).update(data).digest("base64");

// ── Booking link tokens: v1.<nonce>.<expiry>.<sig> — opaque, signed, expiring, one-time (consumed in DB) ──
export function signBookingToken(secret: string, ttlSeconds = 60 * 60 * 24 * 14, now = Date.now()) {
  const nonce = randomToken(18);
  const exp = Math.floor(now / 1000) + ttlSeconds;
  const body = `v1.${nonce}.${exp}`;
  return { token: `${body}.${createHmac("sha256", secret).update(body).digest("base64url")}`, expiresAt: new Date(exp * 1000) };
}

export function verifyBookingToken(secret: string, token: string, now = Date.now()): { ok: true } | { ok: false; reason: "malformed" | "bad_signature" | "expired" } {
  const parts = token.split(".");
  if (parts.length !== 4 || parts[0] !== "v1") return { ok: false, reason: "malformed" };
  const body = parts.slice(0, 3).join(".");
  const expected = createHmac("sha256", secret).update(body).digest("base64url");
  if (!safeEqual(expected, parts[3])) return { ok: false, reason: "bad_signature" };
  if (Number(parts[2]) * 1000 < now) return { ok: false, reason: "expired" };
  return { ok: true };
}

// ── Field encryption for free text and coach notes (AES-256-GCM) ──
function key(): Buffer | null {
  const k = process.env.FIELD_ENCRYPTION_KEY ?? process.env.REFLECTION_ENCRYPTION_KEY;
  if (!k) return null;
  const b = Buffer.from(k, "base64");
  if (b.length !== 32) throw new Error("FIELD_ENCRYPTION_KEY must be 32 bytes, base64-encoded");
  return b;
}
export const encryptionConfigured = () => key() !== null;

export function encrypt(plain: string): string {
  const k = key();
  if (!k) throw new Error("encryption_not_configured");
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", k, iv);
  const data = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return `g1:${iv.toString("base64")}:${c.getAuthTag().toString("base64")}:${data.toString("base64")}`;
}

export function decrypt(blob: string): string {
  const k = key();
  if (!k) throw new Error("encryption_not_configured");
  const [v, iv, tag, data] = blob.split(":");
  if (v !== "g1") throw new Error("unknown_ciphertext_version");
  const d = createDecipheriv("aes-256-gcm", k, Buffer.from(iv, "base64"));
  d.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([d.update(Buffer.from(data, "base64")), d.final()]).toString("utf8");
}
