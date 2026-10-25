/**
 * "Before You Begin" guide (Jana, 25 Oct). Source of truth: Understanding Your Current Life Map.pdf.
 * Every word below is copied verbatim from the PDF, in its order — including its spelling ("authenticly") and its
 * punctuation. Do not edit wording here; change it in the PDF first. **bold** marks the PDF's bold runs.
 */
export const GUIDE = {
  title: "Understanding Your Current Life Map: A Guide to Self-Reflection and Interconnected Life Dimensions",
  infographic: {
    src: "/guide/current-life-map-infographic.jpg",
    width: 1361,
    height: 759,
    // Full text of the infographic, so its information is available to screen readers too.
    alt: "The Current Life Map: See Your Life as It Is. 8 Interconnected Life Domains: Mind, Body, Restoration, Growth, Love, Social World, Resources, and Joy interact continuously. Joy: Pleasure & Experience. Mind: Awareness & Identity. Resources: Money & Environment. Body: Nourishment & Vitality. Social World: Community & Career. Restoration: Recovery & Self-Care. Love: Intimacy & Partnership. Growth: Learning & Evolution. At the centre, Relationship with Yourself at the Core: The quality of conversation with yourself directly transforms your self-relationship and reality. The Guided Self-Interview Process. Engage in Honest Assessment: Answer what is true about energy givers, takers, and personal alignment. First Clarity, Then Action: Focus on seeing reallty clearly before attempting to change anything. 20–25 Minute Private Session: No account or email is required to complete the interview privately. The Whole Picture: Life isn't separate pieces; every domain influences the others simultaneously.",
  },
  sections: [
    {
      id: "internal-conversation",
      heading: "1. Introduction: The Power of Internal Conversation",
      blocks: [
        { p: "Achieving genuine personal clarity begins with the quality of the internal dialogue you hold with yourself every day. Internal conversation is far more than routine self-talk; it is the vital meta-cognitive lens through which raw daily experience is processed into meaningful self-awareness. How you speak to yourself, examine your choices, and evaluate your reality directly dictates how clearly you understand your life's trajectory." },
        { p: "The relationship with yourself changes when the quality of the conversation with yourself changes." },
        { p: "By elevating the depth, structure, and sincerity of this self-conversation, you unlock a clearer, more grounded understanding of your everyday reality. Rather than navigating daily routines on autopilot or reacting blindly to external demands, engaging in deliberate internal dialogue provides the space needed to evaluate how your life actually functions. To engage in this conversation effectively and cultivate true meta-cognitive awareness, however, you must first adopt specific mindsets designed for honest self-reflection." },
      ],
    },
    {
      id: "core-mindsets",
      heading: "2. Core Mindsets for Honest Assessment",
      blocks: [
        { p: "Before evaluating where you stand across various domains of your life, you must establish grounded mental principles for the assessment process. True self-reflection requires setting aside expectations, letting go of idealizations, and engaging with reality as it exists today." },
        { ol: [
          "**Uncompromising Honesty**: Answer what is true for you, not what sounds good. This process is a private conversation with yourself, making absolute truthfulness the essential foundation for meaningful insight.",
          "**Observation Before Action**: Understand that you do not need to change anything right now—the immediate priority is seeing your life clearly first.",
        ] },
        { p: "Humans often reflexively try to \"fix\" uncomfortable realities the moment they are spotted. However, jumping to premature action triggers defensiveness and cognitive bias, causing individuals to hide uncomfortable truths from themselves to avoid immediate distress. Removing the pressure to instantly solve or correct what you observe removes this defensive posture. By permitting yourself to simply observe your life as a neutral bystander without immediate judgment or action, you establish an accurate baseline evaluation, making self-reflection far more accessible, low-stress, and deeply insightful." },
        { p: "With these foundational mindsets established, you can systematically explore the eight structural dimensions that comprise your life map." },
      ],
    },
    {
      id: "eight-dimensions",
      heading: "3. The Eight Dimensions of the Current Life Map",
      blocks: [
        { p: "To view the complete landscape of your existence without getting lost in daily clutter, it is essential to organize your experience through specific structural lenses. The Current Life Map divides your experiences into eight interconnected core dimensions:" },
        { table: {
          caption: "The Eight Life Dimensions",
          head: ["Dimension", "Core Domain & Focus"],
          rows: [
            ["Mind", "Awareness & Identity"],
            ["Body", "Nourishment & Vitality"],
            ["Restoration", "Recovery & Self-Care"],
            ["Growth", "Learning & Evolution"],
            ["Love", "Intimacy & Partnership"],
            ["Social World", "Community & Career"],
            ["Resources", "Money & Environment"],
            ["Joy", "Pleasure & Experience"],
          ],
        } },
        { p: "By systematically evaluating each of these eight dimensions, you acquire a comprehensive, multi-dimensional view of your daily reality. Specifically, this assessment helps you achieve:" },
        { ul: [
          "**Core Priorities**: Identifying what truly matters to you across your daily routines, commitments, and habits.",
          "**Energy Dynamics**: Distinguishing between the specific activities and environments that act as energy sources versus those that serve as constant energy drains.",
          "**Identity Alignment**: Measuring how deeply connected your daily life feels to who you authenticly are as an individual.",
        ] },
        { p: "While these dimensions offer a clear framework for categorizing your experiences, they do not exist as isolated silos; rather, they function continuously as an interdependent system." },
      ],
    },
    {
      id: "interconnected-life-system",
      heading: "4. The Interconnected Life System",
      blocks: [
        { p: "Your life is not made of separate, compartmentalized pieces. Every domain continuously interacts with, feeds into, and influences the others, forming a dynamic web that shapes your total everyday reality. Focusing solely on one area while ignoring another inevitably creates systemic blind spots." },
        { p: "For example, chronic depletion in **Restoration** (lack of physical recovery and self-care) immediately dulls the **Mind** (reducing clarity, focus, and emotional regulation). Similarly, strain within **Resources** (financial pressure or an unstable physical environment) frequently spills over into friction across your **Social World** (creating tension within career and community relationships). Recognizing these cross-dimensional ripple effects ensures you evaluate the whole picture, enabling you to address root causes rather than merely reacting to symptoms." },
        { p: "Understanding how these dimensions function as an integrated system provides the conceptual foundation for taking practical action through the Self-Interview tool." },
      ],
    },
    {
      id: "practical-blueprint",
      heading: "5. Practical Blueprint: Taking the Guided Self-Interview",
      blocks: [
        { p: "When you are ready to evaluate your Current Life Map, use the following orientation checklist to prepare yourself for the guided Self-Interview:" },
        { ul: [
          "**Estimated Time Commitment**: Plan for 20–25 minutes of quiet, uninterrupted time for focused reflection.",
          "**Privacy Guarantee**: You can complete your evaluation with complete privacy—no account creation, name, or email address is required to complete the interview and receive your Current Life Map.",
          "**Core Objective**: Hold a structured, private conversation with yourself to look honestly at the life you are living and see it exactly as it is.",
        ] },
        { p: "Gaining a clear, unvarnished vision of your current reality is the essential first step toward meaningful, long-term personal growth." },
      ],
    },
  ],
} as const;

/** Navigation outside the document (site wording, not part of the PDF). */
export const GUIDE_NAV = {
  label: "Before You Begin",
  welcomeLink: "Before You Begin",
  welcomeNote: "Understand the philosophy behind The Self-Interview and how to approach your reflection.",
  resultsLink: "Understanding Your Life Map",
};

export type GuideBlock =
  | { p: string }
  | { ol: readonly string[] }
  | { ul: readonly string[] }
  | { table: { caption: string; head: readonly string[]; rows: readonly (readonly string[])[] } };
