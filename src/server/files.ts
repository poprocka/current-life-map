import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Where encrypted attachment bytes live. Production: the private Supabase Storage bucket "client-files", accessed
 * with the signed-in coach's own session (storage RLS requires MFA; see supabase/migrations/0002_storage.sql).
 * Tests: an in-memory store. Callers always encrypt before put and decrypt after get.
 */
export interface FileStore {
  put(path: string, bytes: Uint8Array): Promise<void>;
  get(path: string): Promise<Uint8Array | null>;
  remove(paths: string[]): Promise<void>;
}

const BUCKET = "client-files";

export function supabaseFileStore(sb: SupabaseClient): FileStore {
  return {
    async put(path, bytes) {
      const { error } = await sb.storage.from(BUCKET).upload(path, bytes, { contentType: "application/octet-stream", upsert: false });
      if (error) throw new Error("storage_upload_failed");
    },
    async get(path) {
      const { data, error } = await sb.storage.from(BUCKET).download(path);
      if (error || !data) return null;
      return new Uint8Array(await data.arrayBuffer());
    },
    async remove(paths) {
      if (!paths.length) return;
      const { error } = await sb.storage.from(BUCKET).remove(paths);
      if (error) throw new Error("storage_remove_failed");
    },
  };
}

export function memoryFileStore(): FileStore & { files: Map<string, Uint8Array> } {
  const files = new Map<string, Uint8Array>();
  return {
    files,
    async put(path, bytes) { if (files.has(path)) throw new Error("exists"); files.set(path, bytes); },
    async get(path) { return files.get(path) ?? null; },
    async remove(paths) { for (const p of paths) files.delete(p); },
  };
}
