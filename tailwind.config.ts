import type { Config } from "tailwindcss";
// Design tokens from the brief. Reconcile with the HTML prototype once supplied.
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        linen: { DEFAULT: "#F5EDE2", deep: "#EDE2D3", line: "#DDCFBD" },
        mahogany: "#1F1411",
        burgundy: { DEFAULT: "#540F26", soft: "#7A3348" },
        blush: "#E6C9BF",
        taupe: { DEFAULT: "#9C8A7A", light: "#C2B3A3" },
        gold: { DEFAULT: "#B8924A", light: "#E3C98E" },
      },
      fontFamily: {
        sans: ["Poppins", "Helvetica Neue", "Helvetica", "Arial", "sans-serif"],
        serif: ['"Cormorant Garamond"', '"Cormorant"', "Georgia", "serif"],
      },
      letterSpacing: { eyebrow: "0.22em" },
      keyframes: {
        rise: { from: { opacity: "0", transform: "translateY(8px)" }, to: { opacity: "1", transform: "none" } },
      },
      animation: { rise: "rise 480ms cubic-bezier(.2,.7,.2,1) both" },
    },
  },
} satisfies Config;
