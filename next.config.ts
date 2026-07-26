import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lint and typecheck run as dedicated CI steps (pnpm lint / pnpm typecheck);
  // the build must not duplicate them with a second, differently-configured pass.
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
  // The game is client-rendered; shell screens stay static. No image CDN needed
  // (all art is local, mostly <img>-free UI), so skip the optimizer runtime.
  images: { unoptimized: true },
};

export default nextConfig;
