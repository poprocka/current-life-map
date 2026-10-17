import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  // The PDF is printed by headless Chromium on the server; keep the driver (and the optional serverless build) out of the bundle.
  serverExternalPackages: ["playwright-core", "@sparticuz/chromium"],
  // The renderer loads @sparticuz/chromium dynamically, so file tracing can't see it: ship it with the three PDF routes.
  outputFileTracingIncludes: {
    "/api/report": ["./node_modules/@sparticuz/chromium/**"],
    "/api/report/download": ["./node_modules/@sparticuz/chromium/**"],
    "/api/admin/assessments/[id]/pdf": ["./node_modules/@sparticuz/chromium/**"],
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
