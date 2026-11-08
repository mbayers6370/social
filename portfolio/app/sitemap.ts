import type { MetadataRoute } from "next";
import { portfolioDocuments } from "@/features/public-demo/documents";
export const dynamic = "force-static";
export default function sitemap(): MetadataRoute.Sitemap {
  return ["", ...Object.keys(portfolioDocuments)].map((path) => ({
    url: `https://margin.social/${path ? path + "/" : ""}`,
  }));
}
