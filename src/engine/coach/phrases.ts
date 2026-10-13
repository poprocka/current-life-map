/**
 * Plain-language descriptions of each approved statement, for the private Coach Intelligence Report.
 * `cap`: the capacity the statement describes (support items), written so it reads after "strength in…" / "less of…".
 * `friction`: for reverse-keyed items, the difficulty the statement names (endorsing it = more friction).
 * These paraphrase the exact V10 wording; the report always links back to the exact question and answer.
 */
export interface Phrase { cap: string; friction?: string }

export const PHRASES: Record<string, Phrase> = {
  // Sun
  "sun.01": { cap: "knowing what they truly want, even against others' expectations" },
  "sun.02": { cap: "admitting to themselves when something isn't right" },
  "sun.03": { cap: "being honest with themselves without being cruel to themselves" },
  "sun.04": { cap: "trusting their own judgment on important decisions" },
  "sun.05": { cap: "setting boundaries that respect their needs" },
  "sun.06": { cap: "standing by their needs when it might disappoint someone" },
  "sun.07": { cap: "taking responsibility for mistakes without being defined by them" },
  "sun.08": { cap: "following through on promises made to themselves" },
  "sun.09": { cap: "accepting that they can be ambitious and sensitive, independent and still need closeness" },
  "sun.10": { cap: "keeping their own wellbeing a priority when life gets difficult" },
  "sun.11": { cap: "a sense of what gives their life meaning, even as direction changes" },
  // Mind
  "mind.01": { cap: "making quiet space to hear their own thoughts" },
  "mind.02": { cap: "noticing thoughts without treating every thought as true" },
  "mind.03": { cap: "telling inherited beliefs apart from consciously chosen ones" },
  "mind.04": { cap: "knowing what helps them feel calm and grounded when overwhelmed" },
  "mind.05": { cap: "keeping overthinking, comparison and worry in proportion", friction: "overthinking, comparison or worry taking more attention than they want" },
  "mind.06": { cap: "taking their feelings seriously before deciding how to respond" },
  "mind.07": { cap: "caring deeply without fear of loss controlling their choices" },
  // Body
  "body.01": { cap: "having enough physical energy for everyday demands" },
  "body.02": { cap: "eating in a way that supports their health and energy" },
  "body.03": { cap: "regular movement" },
  "body.04": { cap: "noticing when their body needs rest, food, movement or care" },
  "body.05": { cap: "feeling comfortable and connected to their body" },
  "body.06": { cap: "making choices about their body from care rather than punishment or pressure" },
  "body.07": { cap: "feeling at ease in their body, including in intimacy" },
  // Restoration
  "restoration.01": { cap: "sleep that leaves them rested" },
  "restoration.02": { cap: "protecting rest when life gets busy", friction: "rest and personal care being the first things sacrificed when life gets busy" },
  "restoration.03": { cap: "recovering before reaching exhaustion" },
  "restoration.04": { cap: "personal rituals that help them relax and release stress" },
  "restoration.05": { cap: "self-care that feels like genuine care rather than another thing to do perfectly" },
  "restoration.06": { cap: "resting without guilt" },
  // Growth
  "growth.01": { cap: "actively learning things that interest or challenge them" },
  "growth.02": { cap: "allowing themselves to change, even letting go of an old identity" },
  "growth.03": { cap: "trying things despite fear of failure or judgment", friction: "fear of failure or judgment sometimes stopping them from trying something they want" },
  "growth.04": { cap: "deliberately trying new things" },
  "growth.05": { cap: "growing into the person they want to become" },
  "growth.06": { cap: "acting on what would help them grow", friction: "knowing what would help them grow but putting it off out of fear or self-doubt" },
  // Love
  "love.01": { cap: "being their authentic self in romantic relationships" },
  "love.02": { cap: "communicating needs, desires and boundaries in their intimate life" },
  "love.03": { cap: "an intimate life that feels fulfilling for their stage of life" },
  "love.04": { cap: "feeling connected to their own desire and sexuality" },
  "love.05": { cap: "caring deeply for someone without losing independence, standards or sense of self" },
  "love.06": { cap: "expressing vulnerability without feeling weak" },
  // Social World
  "social.01": { cap: "close people who support who they are and are becoming" },
  "social.02": { cap: "people with whom they feel genuinely seen and understood" },
  "social.03": { cap: "expressing their authentic self socially and professionally without seeking approval" },
  "social.04": { cap: "a career or work investment that feels right for the life they want" },
  "social.05": { cap: "contributing to people or communities beyond work" },
  "social.06": { cap: "belonging to a community where they can be themselves" },
  "social.07": { cap: "recognising when a relationship or environment drains them" },
  // Resources
  "resources.01": { cap: "clear awareness of their financial reality" },
  "resources.02": { cap: "earning, spending and saving in a way that supports the life they want" },
  "resources.03": { cap: "a home and surroundings that support their wellbeing" },
  "resources.04": { cap: "feeling able to make meaningful decisions about money and living conditions" },
  "resources.05": { cap: "openness to changing financial or living circumstances", friction: "staying in familiar financial or living circumstances because change feels uncertain" },
  "resources.06": { cap: "enough freedom and room to grow in their financial and living situation" },
  // Joy
  "joy.01": { cap: "regularly doing things purely for the joy of it" },
  "joy.02": { cap: "enjoying pleasure or rest without needing to earn it" },
  "joy.03": { cap: "room for creativity, beauty, play or meaningful experiences" },
  "joy.04": { cap: "making time for what makes them feel alive" },
  "joy.05": { cap: "enjoying things that reflect their own interests rather than what looks impressive" },
  "joy.06": { cap: "opportunities to express their creativity and talents" },
  // Congruence (parallel statement)
  "mind.congruence": { cap: "living this area in line with what genuinely matters to them" },
};
for (const o of ["body", "restoration", "growth", "love", "social", "resources", "joy"]) PHRASES[`${o}.congruence`] = PHRASES["mind.congruence"];

/** One open question per Orbit, used as the "deeper question" when no more specific evidence-led question applies. */
export const ORBIT_DEEPER_QUESTION: Record<string, string> = {
  mind: "What occupies their mind most often right now, and how much of it feels chosen?",
  body: "What does caring for their body look like in an ordinary week, and what gets in the way?",
  restoration: "What would recovery look like if they didn't have to earn it first?",
  growth: "What kind of growth feels truly theirs at this point, and what makes it hard to start?",
  love: "What would feeling more fully themselves in intimacy look like, in whatever form intimacy takes in their life now?",
  social: "Where do they feel most like themselves among other people, and where least?",
  resources: "How much influence do they feel they have over their financial and living conditions?",
  joy: "What do they enjoy simply for its own sake, and how often does it happen?",
};
