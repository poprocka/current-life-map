/** Optional reflections shown below the next-step cards on the results page (Jana, 2026-10-12). Verbatim. */
export const POST_MAP_REFLECTIONS = {
  eyebrow: "Optional reflections",
  title: "See your reality more clearly", // headline per Jana, 2026-10-12
  intro:
    "These reflections do not change the visual Map. They give you a little more space to put language around what became visible, question an old story, or name something you may have been moving past. Answer any that feel useful.",
  placeholder: "Optional — write what comes up",
  maxLength: 2000,
  questions: [
    { id: "postmap.01", prompt: "What can you see about your life now that you were not seeing as clearly before this self-interview?" },
    { id: "postmap.02", prompt: "Is there an area of your life that looks right from the outside but does not feel fully like yours when you are honest with yourself?" },
    { id: "postmap.03", prompt: "What are you most tempted to explain away, minimize or postpone after seeing your Map?" },
    { id: "postmap.04", prompt: "Where do you feel the strongest gap between knowing what you need and actually living it?" },
    { id: "postmap.05", prompt: "If you had one hour with someone who would listen closely enough for you to feel fully seen and heard, what would you finally want to say out loud?" },
  ],
} as const;
export const POST_MAP_IDS = POST_MAP_REFLECTIONS.questions.map((q) => q.id) as string[];
