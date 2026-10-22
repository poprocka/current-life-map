/** "Meet Jana" (Jana's copy, 21 Oct). Verbatim: wording, paragraph breaks and emphasis (**bold**) are hers. */
export const MEET_JANA = {
  title: "Hi, I'm Jana.",
  roles: "Coach. Founder. Creator of The Life System™.", // Jana, 21 Oct
  // Opening beside the portrait (Jana, 21 Oct). The "cosmopolitan" paragraphs moved into "So, what's your story?".
  intro: [
    "We spend so much time building careers, relationships, businesses, and lives. But how much time do we spend getting to know the person at the center of it all?",
    "I've built businesses, created brands and products, lived around the world, and reinvented my life more than once.",
    "What I've learned is that the relationship we have with ourselves shapes far more than we realize.",
    "That's why I created **The Life System™** — a framework for understanding ourselves and the interconnected areas of our lives, so we can make more conscious choices about what we build, pursue, and become.",
    "My work is about helping people become more aware of who they are, more confident in what matters to them, and more intentional about the lives they're creating.",
  ],
  /** Each answer is a list of blocks: a paragraph, or a pull quote (a sentence from the answer itself, set large). */
  interview: [
    {
      q: "So, what's your story?",
      a: [
        "I'm a cosmopolitan at heart. Having lived in six places across Europe and the United States, I've learned to feel at home almost anywhere.",
        "Every new place has taught me something about people, cultures, perspectives, and myself. I've always loved immersing myself in a new environment, building meaningful connections, and finding ways to grow and contribute wherever I am.",
        "Today, I call Newport Beach, California, home. A place I once dreamed of living.",
        "I've always been curious about what becomes possible when we take our dreams seriously — and actually do something about them.",
        "As a little girl, I dreamed of studying abroad. At eighteen, I made it happen. I also dreamed of speaking English fluently enough to have the deep conversations I love. Today, I speak four languages, and English has become the language I think in.",
        "That same curiosity led me into entrepreneurship. I've worked with more than 30 startups, scale-ups, corporations and celebrities, founded a design studio, led creative teams, and co-founded an EdTech startup. I built a highly successful creative career almost entirely through referrals, giving me the freedom to choose projects and people I genuinely believed in.",
        "Eventually, I wanted to create something people could touch and experience, so I launched The Pearl Kit and my Jasia clothing collection. I also fulfilled another dream: earning an MBA in the United States.",
        "But some of my favorite achievements are much more personal.",
        "I once dreamed of having a beautiful green property where I could walk my dogs. Years later, walking down a path toward the lake on my property in Austin, I suddenly realized I was living that exact dream.",
        "I cried.",
        "I've had quite a few moments like that. Including realizing that I now live in Newport Beach, California — another place I once imagined calling home.",
        { quote: "The more conscious I've become of my own life, the more I've realized how much our choices shape it." },
        "And I'm still curious about what I'll create next.",
      ],
    },
    {
      q: "How did you end up coaching?",
      a: [
        "People have always been my favorite part of building anything.",
        "I've led teams, mentored professionals, facilitated workshops, and helped women build confidence through wellbeing programs.",
        "I love discovering what makes someone unique — their strengths, talents, ambitions, contradictions, and possibilities.",
        "My own coach once called me a **harmony coach**, and I liked that.",
        "Because to me, success isn't just about what you achieve. It's about creating a life where the things that matter to you can coexist — in a way that feels right for you.",
      ],
    },
    {
      q: "What's your approach?",
      a: [
        "I don't believe in a one-size-fits-all formula for life.",
        "We start with your Current Life Map, exploring where you stand today and how the different parts of your life connect.",
        "From there, our work is personal. I ask questions, offer perspective, challenge assumptions, and support you as you discover what matters to you and make choices that reflect it.",
        "And because understanding yourself is only the beginning, we'll find practical ways to put those insights into action — with tools and practices tailored to who you are, what you need, and the life you're actually living.",
        "I'm not here to tell you who to become.",
        { quote: "I'm here to help you see what you're capable of — and support you as you find your own way." },
      ],
    },
    {
      q: "And what's Jana like outside of coaching?",
      a: [
        "Curious. Playful. Direct. Warm. A little Viking energy, courtesy of my Slavic roots.",
        "I love staying active, whether it's a good workout, a sport, or simply spending time outdoors. I'm drawn to aesthetics in all their forms — the human body, design, architecture, art, and the little details that make everyday life more interesting.",
        "I appreciate depth. In conversations, relationships, books, and the way people think. I'm equally happy discussing business ideas, human nature, or the meaning of life over coffee.",
        "Nature keeps me grounded, my dachshund keeps me entertained, and creating things that make life more beautiful and meaningful is something I never seem to get tired of.",
        "And I'll probably ask you more questions than you expected.",
      ],
    },
  ] as { q: string; a: (string | { quote: string })[] }[],
  closing: {
    q: "Now, it's your turn. I'd love to hear your story.",
    text: "If you're curious about what we could explore together, let's talk.",
    cta: "Apply for 1:1 coaching",
    hello: "Or come say hello:",
    instagram: { label: "@poprotska", href: "https://www.instagram.com/poprotska/" },
    email: { label: "jana@jasia.beauty", href: "mailto:jana@jasia.beauty" },
  },
};

/** The one portrait on the page: Jana seated in a wooden chair, looking at the camera. File: public/jana.jpg. */
export const PORTRAIT = {
  src: "/jana.jpg",   // from Jana.png, resized to 1200 × 1800 (original proportions), JPEG ~165 KB
  width: 1200,
  height: 1800,
  alt: "Jana Poprocka seated in a wooden chair, looking directly at the camera",
};

/** Small round avatar (the same photograph, cropped to the face) for the coaching banner. File: public/jana-avatar.jpg. */
export const AVATAR = { src: "/jana-avatar.jpg", alt: "Jana Poprocka" };
