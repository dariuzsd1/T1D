import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    /**
     * A value that changes with every deployment. The client is compiled with
     * it; /api/version reports whatever the CURRENTLY deployed server has. When
     * they disagree, the tab is running an older bundle than the one being
     * served, which is the only way a long-lived session can find that out.
     *
     * Vercel supplies the commit SHA at build time. Locally it is 'dev' for both
     * sides, so the check stays silent in development.
     */
    NEXT_PUBLIC_BUILD_ID: process.env.VERCEL_GIT_COMMIT_SHA ?? 'dev',
  },
};

export default nextConfig;
