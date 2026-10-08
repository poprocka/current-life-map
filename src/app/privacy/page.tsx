import Link from "next/link";

// Audit C3: placeholder until the reviewed notice is supplied.
export default function Privacy() {
  return (
    <main className="mx-auto max-w-[640px] px-6 py-16">
      <Link href="/" className="eyebrow hover:text-burgundy">← The Current Life Map</Link>
      <h1 className="mt-8 font-serif text-[40px] font-light">Privacy &amp; Data Use Notice</h1>
      <p role="note" className="mt-6 border border-burgundy/40 px-4 py-3 text-[13px] text-burgundy">
        Draft placeholder — this notice has not been written or reviewed yet. It must describe anonymous completion,
        email collection for PDF delivery, booking linkage to a Map, research use, retention and deletion, and the
        vendors involved, and be reviewed before public launch.
      </p>
    </main>
  );
}
