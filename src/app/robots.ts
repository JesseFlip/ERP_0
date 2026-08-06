import type { MetadataRoute } from "next";

// This is an internal business tool, not a public site — keep it out of search
// indexes regardless of which URL it ends up deployed at.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      disallow: "/",
    },
  };
}
