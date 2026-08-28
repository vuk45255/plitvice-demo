import type { MetadataRoute } from "next";
import { INFO, infoHref } from "@/lib/local-info";

const HOST = "https://plitviceclub.com";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://plitviceclub.com",
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: "https://plitviceclub.com/rezervacija",
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: "https://plitviceclub.com/o-nama",
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: "https://plitviceclub.com/zurke",
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: "https://plitviceclub.com/atmosfera",
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: "https://plitviceclub.com/trenutci",
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: "https://plitviceclub.com/cenovnik",
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    /* The concierge, read off the same list the cards and the routes are read
       off — six pages that can never fall out of step with the six cards. */
    ...INFO.map((category) => ({
      url: `${HOST}${infoHref(category)}`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
  ];
}
