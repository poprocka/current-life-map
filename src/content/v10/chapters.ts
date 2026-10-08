import type { Chapter, OrbitId } from "../types";

// Exact V10 wording. Sun is the centre, not a ninth Orbit. Orbit numbers are never displayed.
export const CHAPTERS: Chapter[] = [
  {
    id: "sun",
    kind: "sun",
    name: "The Sun",
    subtitle: "Relationship With Self",
    description:
      "The center of the system: how well you know yourself, whether you listen to yourself, trust yourself and stay on your own side.",
    reflectionCue:
      "How do you treat yourself when your needs, values or feelings become difficult to honor?",
    explores: ["self-knowledge", "values", "honesty", "self-talk", "self-trust", "boundaries", "accountability", "self-loyalty"],
  },
  {
    id: "mind",
    kind: "orbit",
    name: "Mind",
    subtitle: "Awareness & Identity",
    description:
      "Your inner world shapes how you experience your outer world. Mind is about the thoughts you give attention to, the beliefs you carry, and your ability to find clarity and inner peace.",
    reflectionCue:
      "Notice what occupies your mind, what you believe, and how much space you have to think for yourself.",
    explores: ["mental hygiene", "awareness", "beliefs", "intentions", "emotional intelligence", "rumination", "inner peace"],
  },
  {
    id: "body",
    kind: "orbit",
    name: "Body",
    subtitle: "Nourishment & Vitality",
    description:
      "Your body carries you through every part of your life. How you nourish it, move it and listen to it shapes your energy, health and capacity to live fully.",
    reflectionCue: "Think about how you actually treat your body, not just what you know is good for it.",
    explores: ["nourishment", "movement", "vitality", "body awareness", "embodiment", "body confidence", "body relationship"],
  },
  {
    id: "restoration",
    kind: "orbit",
    name: "Restoration",
    subtitle: "Recovery & Self-Care",
    description:
      "Rest is not something you earn after doing enough. Sleep, recovery and personal rituals help you restore your energy and return to yourself.",
    reflectionCue: "Look at whether you give yourself permission and space to recover before you're exhausted.",
    explores: ["sleep", "recovery", "nervous-system regulation", "self-care", "guilt", "capacity"],
  },
  {
    id: "growth",
    kind: "orbit",
    name: "Growth",
    subtitle: "Learning & Evolution",
    description:
      "Learning and curiosity keep your mind alive. Growth is about exploring new ideas, developing your abilities and allowing yourself to evolve beyond who you've been.",
    reflectionCue: "Consider whether you're still giving yourself room to learn, change and discover new possibilities.",
    explores: ["learning", "curiosity", "reinvention", "fear", "procrastination", "confidence", "development"],
  },
  {
    id: "love",
    kind: "orbit",
    name: "Love",
    subtitle: "Intimacy & Partnership",
    description:
      "Your intimate life is about more than being in a relationship. It includes emotional closeness, desire, vulnerability, communication and the ability to stay true to yourself while loving someone.",
    reflectionCue:
      "Think about how you experience intimacy, whether you feel seen and desired, and whether you can remain yourself in connection.",
    explores: ["intimacy", "attachment", "desire", "communication", "standards", "emotional safety", "vulnerability"],
  },
  {
    id: "social",
    kind: "orbit",
    name: "Social World",
    subtitle: "Community, Career & Contribution",
    description:
      "The people around you and the roles you hold in society influence your energy, perspective and sense of belonging. Your social and professional worlds should give you room to connect, contribute and express your authentic self.",
    reflectionCue:
      "Think about the people you spend time with, the environments you enter and who you become around them.",
    explores: [
      "family", "friendship", "career", "community", "social roles", "status and reputation",
      "belonging", "social influence", "authenticity", "contribution", "relational energy",
    ],
  },
  {
    id: "resources",
    kind: "orbit",
    name: "Resources",
    subtitle: "Money & Environment",
    description:
      "Money and your physical environment shape the choices available to you. Understanding and intentionally managing these resources creates more freedom and room to build the life you want.",
    reflectionCue:
      "Think about the practical conditions of your life: your finances, your home, your country, city and neighborhood, and the everyday places where you spend your time. How much influence do you have over these conditions?",
    explores: ["financial clarity", "financial habits", "home", "wider physical environment", "freedom", "agency", "readiness for change"],
  },
  {
    id: "joy",
    kind: "orbit",
    name: "Joy",
    subtitle: "Pleasure & Experience",
    description:
      "Joy is not a reward for being productive. Pleasure, beauty, creativity and meaningful experiences are part of what makes life worth living.",
    reflectionCue: "Notice whether your life includes things you genuinely enjoy, simply because you enjoy them.",
    explores: ["pleasure", "passion", "happiness", "creativity", "authenticity", "aliveness"],
  },
  {
    id: "interconnections",
    kind: "interconnections",
    name: "Life Interconnections",
    subtitle: "",
    description:
      "Your life works as a whole. Each area influences the others through your choices, time, attention, relationships and energy.",
    reflectionCue: "Look at how the different areas of your life support or compete with one another.",
    explores: [],
  },
];

export const ORBIT_IDS: OrbitId[] = ["mind", "body", "restoration", "growth", "love", "social", "resources", "joy"];

export const chapterById = (id: string): Chapter => {
  const c = CHAPTERS.find((c) => c.id === id);
  if (!c) throw new Error(`Unknown chapter ${id}`);
  return c;
};
