/**
 * Every reflection question on the results page and in the PDF sits in the same outlined block (Jana, 2026-10-13):
 * a hairline burgundy outline only (no fill), serif italic in burgundy. An optional small all-caps label sits inside,
 * above the question (Orbits: "A question to ask yourself").
 */
export function QuestionBlock({ children, size = "md", className = "", label }: { children: React.ReactNode; size?: "sm" | "md" | "lg"; className?: string; label?: string }) {
  const text = size === "lg" ? "text-[26px] font-light leading-snug sm:text-[30px] [text-wrap:balance]" : size === "sm" ? "text-[17px] leading-relaxed" : "text-[19px] leading-relaxed";
  const pad = size === "lg" ? "px-8 py-7" : "px-5 py-4";
  if (!label) return <p className={`rounded-[16px] border border-burgundy/25 font-serif italic text-burgundy ${pad} ${text} ${className}`}>{children}</p>;
  return (
    <div className={`rounded-[16px] border border-burgundy/25 ${pad} ${className}`}>
      <p className="eyebrow">{label}</p>
      <p className={`mt-1.5 font-serif italic text-burgundy ${text}`}>{children}</p>
    </div>
  );
}
