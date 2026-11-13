import type { MetadataRoute } from "next";

// Installed as an app, the icons fill their square: the OS rounds the corners itself
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Atlas",
    short_name: "Atlas",
    description: "Describe a pipeline in a sentence. Atlas writes the dbt models, SQL, tests and docs, grounded in your DataHub catalog.",
    start_url: "/new",
    display: "standalone",
    background_color: "#141311",
    theme_color: "#141311",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
