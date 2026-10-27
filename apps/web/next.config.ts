import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // the old control-center pages; the sidebar's runs list replaced both
  async redirects() {
    return [
      { source: "/dashboard", destination: "/new", permanent: true },
      { source: "/agents", destination: "/new", permanent: true },
    ];
  },
};

export default nextConfig;
