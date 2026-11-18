import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    // Photos come from Wikimedia Commons, which serves its own resized
    // thumbnails. The loader picks the right one, so Next.js doesn't resize.
    loader: "custom",
    loaderFile: "./src/lib/image-loader.ts",
    // Widths Commons serves; srcset is built from these.
    deviceSizes: [500, 960, 1280, 1920],
    imageSizes: [250, 330],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
