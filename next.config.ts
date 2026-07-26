import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /*
    Expose the Vercel deploy environment to the client bundle so the ClubHome v2
    fixtures guard (src/lib/clubhome/client.ts › fixturesAllowed) can allow rich
    fixture data in dev / preview but NEVER in production. Vercel sets VERCEL_ENV
    to 'production' | 'preview' | 'development'; undefined for a bare local build.
  */
  env: {
    NEXT_PUBLIC_VERCEL_ENV: process.env.VERCEL_ENV,
  },
};

export default nextConfig;
