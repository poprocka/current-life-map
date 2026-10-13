import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  // The PDF is printed by headless Chromium on the server; keep the driver (and the optional serverless build) out of the bundle.
  serverExternalPackages: ["playwright-core", "@sparticuz/chromium"],
  async headers() {
    return [{ source: "/(.*)", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Frame-Options", value: "DENY" },
    ] }];
  },
};
export default nextConfig;
