/**
 * Current Life Map — V10 question bank.
 * Every prompt and cue below is copied verbatim from the V10 specification.
 * Do not edit wording here without a new content version.
 */
import type { ChapterId, Question, OrbitId } from "../types";
import { CHAPTERS, ORBIT_IDS, chapterById } from "./chapters";
import { TRUTH_SCALE, IMPORTANCE_SCALE, ENERGY_SCALE, SUPPORT_COMPETE_OPTIONS } from "./scales";

export const CONTENT_VERSION = "v10" as const;

const SUPPORT_CUE = "Stronger agreement indicates more of this reported capacity/experience; interpret in context.";
const FRICTION_CUE = "Reverse-keyed: stronger agreement indicates greater friction in this construct.";

/** [prompt, construct, signal, reverseKeyed] */
type Row = [string, string, string, boolean?];

const STATEMENTS: Record<Exclude<ChapterId, "interconnections">, Row[]> = {
  sun: [
    ["I know what I truly want, even when others expect something different from me.", "Self-knowledge", "Authentic desire"],
    ["When something in my life isn't right, I admit it to myself instead of pretending everything is fine.", "Honesty", "Reality recognition"],
    ["I can be honest with myself about difficult things without being cruel to myself.", "Self-talk", "Self-compassion"],
    ["I trust myself to make important decisions about my life.", "Self-trust", "Decision confidence"],
    ["I set boundaries that respect my needs and what matters to me.", "Boundaries", "Needs and values"],
    ["I can stand by my needs, even when it might disappoint someone or make things uncomfortable.", "Self-loyalty", "Standing by needs"],
    ["I take responsibility for my mistakes without letting them define who I am.", "Accountability", "Responsibility without shame"],
    ["When I make a promise to myself, I follow through.", "Accountability", "Self-follow-through"],
    ["I accept that I can be ambitious and sensitive, independent and still need closeness.", "Self-acceptance", "Identity integration"],
    ["When life gets difficult, I still make my own wellbeing a priority.", "Self-care", "Wellbeing under pressure"],
    ["I have a sense of what gives my life meaning, even when my direction is changing.", "Meaning", "Personal meaning"],
  ],
  mind: [
    ["I make enough quiet space to hear my own thoughts.", "Awareness", "Inner attention"],
    ["I can notice my thoughts without assuming every thought is true.", "Awareness", "Thought defusion"],
    ["I can tell the difference between beliefs I grew up with and beliefs I have consciously chosen for myself.", "Beliefs", "Inherited versus chosen beliefs"],
    ["When my mind feels overwhelmed, I know what helps me feel calm and grounded again.", "Inner peace", "Self-regulation"],
    ["Overthinking, comparison or worrying takes more of my attention than I want.", "Rumination", "Mental energy drain", true],
    ["I take my feelings seriously and consider what they may be telling me before deciding how to respond.", "Emotional intelligence", "Emotional validation"],
    ["I can care deeply about someone or something without letting the fear of losing it disturb my inner peace or control my choices.", "Emotional intelligence", "Fear of loss and inner peace"],
  ],
  body: [
    ["My body has enough energy for the demands of my everyday life.", "Vitality", "Functional energy"],
    ["The way I eat generally supports my health, energy and wellbeing.", "Nourishment", "Food and wellbeing"],
    ["Movement is a regular part of my life.", "Movement", "Movement regularity"],
    ["I pay attention when my body tells me it needs rest, food, movement or care.", "Body awareness", "Responding to body signals"],
    ["I feel comfortable and connected to my body.", "Embodiment", "Body connection"],
    ["I make choices about my body from a place of care rather than punishment or pressure.", "Body relationship", "Care versus punishment"],
    ["I feel confident and at ease in my body, including in moments of intimacy.", "Body confidence", "Intimacy and ease"],
  ],
  restoration: [
    ["I get enough sleep to feel rested and function well.", "Sleep", "Restorative sleep"],
    ["When life gets busy, rest and personal care are among the first things I sacrifice.", "Recovery", "Sacrificing rest", true],
    ["I make time to recover before I reach exhaustion.", "Recovery", "Proactive recovery"],
    ["I have personal rituals that help my body relax and release stress.", "Self-care", "Relaxation rituals"],
    ["My self-care feels like genuine care rather than another thing I have to do perfectly.", "Self-care", "Performance pressure"],
    ["I can rest without feeling guilty or thinking I should be productive.", "Guilt", "Permission to rest"],
  ],
  growth: [
    ["I'm actively learning things that interest or challenge me.", "Learning", "Active learning"],
    ["I allow myself to change, even when it means letting go of an old identity or direction.", "Reinvention", "Identity flexibility"],
    ["Fear of failure or judgment sometimes stops me from trying something I want to do.", "Fear", "Fear of judgment or failure", true],
    ["I deliberately try new things that help me learn or grow.", "Curiosity", "Experimentation"],
    ["I feel that I'm growing into the person I want to become.", "Development", "Becoming"],
    ["I often know what would help me grow but put it off because I fear failure, judgment or lack confidence in myself.", "Procrastination", "Fear-driven delay", true],
  ],
  love: [
    ["I can be my authentic self in romantic relationships without hiding important parts of who I am.", "Authenticity", "Self-expression in intimacy"],
    ["I can openly communicate my needs, desires and boundaries in my intimate life.", "Communication", "Needs and desires"],
    ["My romantic or intimate life feels fulfilling for the stage of life I'm in.", "Intimacy", "Current fulfillment"],
    ["I feel connected to my own desire and sexuality.", "Desire", "Sexual self-connection"],
    ["I can care deeply for someone without losing my independence, standards or sense of self.", "Standards", "Selfhood in closeness"],
    ["I can express vulnerability without feeling that it makes me weak.", "Vulnerability", "Emotional openness"],
  ],
  social: [
    ["The people closest to me generally support the person I am and the person I'm becoming.", "Social influence", "Supportive relationships"],
    ["There are people in my life with whom I feel genuinely seen and understood.", "Belonging", "Being seen and understood"],
    ["I can express my authentic self in social and professional situations without constantly seeking approval.", "Authenticity", "Social approval"],
    ["The time and energy I give to my career or work feel right for the life I want to live.", "Career", "Work-life fit"],
    ["I make room to contribute to people or communities beyond my work in ways that matter to me.", "Contribution", "Community contribution"],
    ["I feel that I belong to a community where I can be myself.", "Belonging", "Community belonging"],
    ["I can recognize when a relationship or social environment consistently drains my energy.", "Relational energy", "Recognizing draining social dynamics"],
  ],
  resources: [
    ["I am fully aware of my financial reality and can make informed decisions about it.", "Financial clarity", "Financial awareness"],
    ["The way I earn, spend and save money supports the lifestyle I want to live.", "Financial habits", "Alignment of money choices"],
    ["My home and surroundings support my wellbeing and everyday routines.", "Physical environment", "Daily surroundings"],
    ["I feel able to make meaningful decisions about my finances and living conditions.", "Agency", "Practical choice"],
    // Shortened from V10 by Jana, 2026-10-12 (removed ", even when I know those circumstances no longer support the life I want")
    ["I tend to stay in familiar financial or living circumstances because change feels uncertain.", "Readiness for change", "Familiarity versus growth", true],
    ["My financial and living situation give me enough freedom and room to grow at this stage of my life.", "Freedom", "Room to grow"],
  ],
  joy: [
    ["I regularly do things simply because they bring me joy.", "Pleasure", "Joy in daily life"],
    ["I can enjoy pleasure or rest without feeling that I need to earn it.", "Pleasure", "Enjoyment without earning"],
    ["My life has enough room for creativity, beauty, play or meaningful experiences.", "Creativity", "Space for play and beauty"],
    ["I make time for what makes me feel alive.", "Aliveness", "Vital experiences"],
    ["The things I enjoy reflect my own interests rather than what looks impressive to others.", "Authenticity", "Intrinsic interests"],
    // Replaced by Jana, 2026-10-12. Was: "I make room for enjoyment that feels genuinely my own." (Happiness → Self-directed enjoyment)
    // Cue for the new item is proposed (construct/signal not yet approved).
    ["I give myself opportunities to express my creativity and talents.", "Creativity", "Creative self-expression"],
  ],
};

/** [prompt, construct, signal] — V10 Life Interconnections */
const INTERCONNECTIONS: Row[] = [
  ["Which Orbit currently takes the most of your time, attention or emotional energy?", "Energy allocation", "Largest time and energy demand"],
  ["Which Orbit gives you the most energy or makes you feel most alive?", "Energy flow", "Largest energy source"],
  ["If improving one Orbit could positively influence the rest of your life, which would you choose?", "System leverage", "Perceived positive spillover"],
  ["Which Orbit receives less care because another part of your life demands so much?", "Trade-offs", "Crowded-out Orbit"],
  ["What matters to you but gets less of your time and energy than you would like?", "Priority alignment", "Values versus time and energy"],
  // Reworded by Jana, 2026-10-12. Was: "Which Orbit feels most shaped by habits or other people's expectations rather than your own choices?"
  ["Which Orbit is most influenced by other people’s expectations or social standards?", "Agency", "Other-directed versus self-directed"],
  ["Do the different areas of your life mostly help each other, or do they compete for your time and energy?", "Interdependence", "Support versus competition"],
];

/** Feelings / inner states per Orbit — exact lists supplied by Jana, 2026-10-12. Order preserved. */
const EMOTION_OPTIONS: Record<OrbitId, string[]> = {
  mind: ["Clarity", "Peace", "Curiosity", "Confidence", "Openness", "Neutrality", "Busyness", "Unease", "Rumination", "Pressure", "Distraction", "Fatigue"],
  body: ["Strength", "Energy", "Capability", "Ease", "Connection", "Neutrality", "Self-consciousness", "Frustration", "Tension", "Depletion", "Criticism", "Disconnection"],
  restoration: ["Restfulness", "Calm", "Softness", "Replenishment", "Care", "Spaciousness", "Restlessness", "Rush", "Overload", "Depletion", "Guilt", "Exhaustion"],
  growth: ["Curiosity", "Inspiration", "Excitement", "Capability", "Hope", "Momentum", "Stretch", "Uncertainty", "Impatience", "Stagnation", "Intimidation", "Overwhelm"],
  love: ["Connection", "Safety", "Desire", "Tenderness", "Aliveness", "Ease", "Longing", "Uncertainty", "Loneliness", "Frustration", "Guardedness", "Resentment"],
  social: ["Connection", "Support", "Belonging", "Recognition", "Energy", "Ease", "Stretch", "Self-consciousness", "Loneliness", "Drain", "Pressure", "Displacement"],
  resources: ["Security", "Clarity", "Capability", "Freedom", "Groundedness", "Stability", "Constraint", "Uncertainty", "Pressure", "Avoidance", "Overwhelm", "Fear"],
  joy: ["Aliveness", "Playfulness", "Inspiration", "Peace", "Delight", "Freedom", "Restlessness", "Boredom", "Guilt", "Disconnection", "Deprivation", "Numbness"],
};

/** Audit C4: Love items that presuppose a romantic relationship. */
const LOVE_NOT_APPLICABLE = new Set([2, 3]); // Q1 removed (Jana, 2026-10-12)

function exploreFor(chapterId: ChapterId, construct: string): string {
  return construct.toLowerCase();
}

function build(): Question[] {
  const out: Question[] = [];
  const orbitOptions = ORBIT_IDS.map((id) => ({ value: id, label: chapterById(id).name }));

  for (const chapter of CHAPTERS) {
    if (chapter.id === "interconnections") continue;
    const rows = STATEMENTS[chapter.id as Exclude<ChapterId, "interconnections">];
    rows.forEach(([prompt, construct, signal, rev], i) => {
      const order = i + 1;
      const explore = exploreFor(chapter.id, construct);
      const inList = chapter.explores.includes(explore);
      out.push({
        id: `${chapter.id}.${String(order).padStart(2, "0")}`,
        version: CONTENT_VERSION,
        chapterId: chapter.id,
        order,
        prompt,
        responseType: "truth",
        options: TRUTH_SCALE,
        exploreCategory: explore,
        cue: { construct, signal, text: `${construct} → ${signal}. ${rev ? FRICTION_CUE : SUPPORT_CUE}` },
        direction: rev ? "friction" : "support",
        reverseKeyed: !!rev,
        optional: false,
        allowNotApplicable: chapter.id === "love" && LOVE_NOT_APPLICABLE.has(order),
        enabled: true,
        needsConfirmation: [
          ...(!inList ? [`C10: construct "${construct}" is not in the ${chapter.name} Explore list`] : []),
          ...(chapter.id === "love" && LOVE_NOT_APPLICABLE.has(order) ? ["C4: Not-applicable option scope"] : []),
        ],
      });
    });

    if (chapter.kind === "orbit") {
      const n = rows.length;
      out.push({
        id: `${chapter.id}.importance`,
        version: CONTENT_VERSION,
        chapterId: chapter.id,
        order: n + 1,
        prompt: `How important is ${chapter.name} in your life right now?`,
        responseType: "importance",
        options: IMPORTANCE_SCALE,
        exploreCategory: "importance",
        cue: { construct: "Importance", signal: "Stated importance", text: "Orbit importance." },
        direction: "context",
        reverseKeyed: false,
        optional: false,
        allowNotApplicable: false,
        enabled: true,
      });
      out.push({
        id: `${chapter.id}.energy`,
        version: CONTENT_VERSION,
        chapterId: chapter.id,
        order: n + 2,
        prompt: `As ${chapter.name} exists in your life today, what happens to your energy?`,
        responseType: "energy",
        options: ENERGY_SCALE,
        exploreCategory: "energy",
        cue: { construct: "Energy", signal: "Energy flow", text: "Orbit energy." },
        direction: "context",
        reverseKeyed: false,
        optional: false,
        allowNotApplicable: false,
        enabled: true,
      });
      // Audit C1 resolved: wording and options supplied by Jana, 2026-10-12.
      out.push({
        id: `${chapter.id}.emotion`,
        version: CONTENT_VERSION,
        chapterId: chapter.id,
        order: n + 3,
        prompt: `When you think about your ${chapter.name} Orbit as it is today, which feelings or inner states are most present?`,
        instruction: "Choose up to 3.",
        responseType: "emotional_state",
        options: EMOTION_OPTIONS[chapter.id as OrbitId].map((label) => ({ value: label.toLowerCase().replace(/[^a-z]+/g, "-"), label })),
        maxSelections: 3,
        exploreCategory: "inner state",
        cue: { construct: "Inner State", signal: "Orbit-specific feelings", text: "Choose up to three Orbit-specific feelings or inner states." },
        direction: "context",
        reverseKeyed: false,
        optional: false, // at least one, up to three
        allowNotApplicable: false,
        enabled: true,
        interpretationNotes:
          "Raw selections only. Not scored into Vitality or Congruence until a mapping is approved; shown as reported feelings in results and the Coach Report.",
      });
    }
  }

  INTERCONNECTIONS.forEach(([prompt, construct, signal], i) => {
    const order = i + 1;
    const isQ7 = order === 7;
    out.push({
      id: `interconnections.${String(order).padStart(2, "0")}`,
      version: CONTENT_VERSION,
      chapterId: "interconnections",
      order,
      prompt,
      responseType: isQ7 ? "single_choice" : "orbit_select",
      options: isQ7 ? SUPPORT_COMPETE_OPTIONS : orbitOptions,
      exploreCategory: construct.toLowerCase(),
      // V10 cue text is retained verbatim, including its boilerplate (audit C6)
      cue: { construct, signal, text: `${construct} → ${signal}. ${SUPPORT_CUE}` },
      direction: "selection",
      reverseKeyed: false,
      optional: false,
      allowNotApplicable: false,
      enabled: true,
      interpretationNotes:
        "Selection/comparison, not an agreement score. Informs cross-Orbit hypotheses and attention order; never summed as a scale.",
      needsConfirmation: [
        "C6: cue boilerplate refers to agreement",
        ...(!isQ7 ? ["C5: option set assumed to be the eight Orbits (Sun not selectable)"] : []),
        ...(order === 5 ? ["C5: Orbit selection vs free text"] : []),
      ],
    });
  });

  // Optional closing reflection, shown last, before the Map (Jana, 2026-10-12).
  // Free text: never scored; stored with the sensitive reflections, not with scored answers.
  out.push({
    id: "interconnections.reflection",
    version: CONTENT_VERSION,
    chapterId: "interconnections",
    order: INTERCONNECTIONS.length + 1,
    prompt: "What truth about your current life became harder to ignore while answering these questions?",
    instruction: "Optional.",
    responseType: "text",
    options: [],
    maxLength: 2000,
    exploreCategory: "reflection",
    cue: { construct: "Reflection", signal: "Truth becoming harder to ignore", text: "Free-text reflection. Not scored; context for the respondent's report and the Coach Report." },
    direction: "context",
    reverseKeyed: false,
    optional: true,
    allowNotApplicable: false,
    enabled: true,
  });

  return out;
}

export const QUESTION_BANK: Question[] = build();

/** Questions actually presented to respondents, in V10 order. */
export const ACTIVE_QUESTIONS: Question[] = QUESTION_BANK.filter((q) => q.enabled);

export const questionById = (id: string) => QUESTION_BANK.find((q) => q.id === id);

export const orbitQuestions = (orbit: OrbitId) =>
  QUESTION_BANK.filter((q) => q.chapterId === orbit && q.responseType === "truth");
