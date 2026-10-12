"use client";
/**
 * Hand a generated file to the viewer. Inside a claude.ai preview the page must go through the
 * host's `downloads` capability; on the real site a normal browser download is used.
 */
type Downloads = { save(r: { filename: string; data: Blob }): Promise<unknown> };
type Host = { use?: (name: string) => Promise<unknown> };

export async function saveFile(filename: string, blob: Blob): Promise<void> {
  const host = (globalThis as { claude?: Host }).claude;
  if (host?.use) {
    const d = (await host.use("downloads")) as Downloads | null;
    if (d) { await d.save({ filename, data: blob }); return; }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
