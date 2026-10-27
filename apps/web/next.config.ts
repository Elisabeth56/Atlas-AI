import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 55 is for photos shown at low opacity behind content, where the extra bytes buy nothing
  images: { qualities: [55, 75] },
  // the old control-center pages; the sidebar's runs list replaced both
  async redirects() {
    return [
      { source: "/dashboard", destination: "/new", permanent: true },
      { source: "/agents", destination: "/new", permanent: true },
      { source: "/demo", destination: "/new", permanent: true },
    ];
  },
};

export default nextConfig;
