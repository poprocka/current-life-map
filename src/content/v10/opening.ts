// Exact V10 Opening copy.
export const OPENING = {
  title: "See your life as it is.",
  lead: "The relationship with yourself changes when the quality of the conversation with yourself changes.",
  paragraphs: [
    "This guided Self-Interview helps you look honestly at the life you're living: what matters to you, what gives you energy, what takes it away, and how connected your life feels to who you are.",
    "Your life isn't made of separate pieces. Every area influences the others, and together they shape your everyday reality. The Current Life Map helps you see the whole picture.",
    "Answer what is true for you, not what sounds good. This is your conversation with yourself. Be honest.",
  ],
  closing: "You don't need to change anything right now. First, see it clearly.",
  cta: "Begin Self-Interview",
  /** Shown above the CTA (Jana, 2026-10-12) */
  estimatedTime: "Estimated time: 20–25 minutes",
} as const;

/**
 * DRAFT — audit C2. V10 requires approved privacy wording here but does not supply it.
 * Replace with Jana's approved line before launch.
 */
export const PRIVACY_LINE = {
  status: "draft" as const,
  text: "Your Self-Interview is anonymous. You don't need to share your name or email to see your Map.",
  linkLabel: "Privacy & Data Use Notice",
};
