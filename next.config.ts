import type { NextConfig } from "next";
import { SHORT_LINKS } from "./src/content/channels";
const nextConfig: NextConfig = {
  // The PDF is printed by headless Chromium on the server; keep the driver (and the optional serverless build) out of the bundle.
  serverExternalPackages: ["playwright-core", "@sparticuz/chromium"],
  // The renderer loads @sparticuz/chromium dynamically, so file tracing can't see it: ship it with the three PDF routes.
  outputFileTracingIncludes: {
    "/api/report": ["./node_modules/@sparticuz/chromium/**"],
    "/api/admin/assessments/[id]/pdf": ["./node_modules/@sparticuz/chromium/**"],
  },
  // Channel short links: /ig, /li, /card … → the public page with UTM tags (temporary redirects, so they can change later).
  async redirects() {
    return SHORT_LINKS.map((l) => ({
      source: `/${l.path}`, permanent: false,
      destination: `/?utm_source=${l.source}&utm_medium=${l.medium}${l.campaign ? `&utm_campaign=${l.campaign}` : ""}`,
    }));
  },
  async headers() {
    return [{ source: "/(.*)", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Frame-Options", value: "DENY" },
    ] }];
  },
};
export default nextConfig;
