import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // packages/shared ships TypeScript source, so Next compiles it.
  transpilePackages: ["@lulu/shared"],
  // Optional: with API_PROXY_TARGET set (for example http://localhost:4000), the web app forwards
  // /api/v1/* to the API, so one address serves both (a shared demo link). Set NEXT_PUBLIC_API_URL=/api/v1.
  async rewrites() {
    const target = process.env.API_PROXY_TARGET;
    return target ? [{ source: "/api/v1/:path*", destination: `${target}/api/v1/:path*` }] : [];
  },
};

export default withNextIntl(nextConfig);
