/**
 * Every reflection question on the results page and in the PDF sits in the same outlined block (Jana, 2026-10-13):
 * a hairline burgundy outline, serif italic in burgundy. `lg` is the closing question.
 */
export function QuestionBlock({ children, size = "md", className = "" }: { children: React.ReactNode; size?: "sm" | "md" | "lg"; className?: string }) {
  const text = size === "lg" ? "text-[26px] font-light leading-snug sm:text-[30px] [text-wrap:balance]" : size === "sm" ? "text-[17px] leading-relaxed" : "text-[19px] leading-relaxed";
  const pad = size === "lg" ? "px-8 py-7" : "px-5 py-4";
  return <p className={`rounded-[16px] border border-burgundy/25 bg-white/30 font-serif italic text-burgundy ${pad} ${text} ${className}`}>{children}</p>;
}
