import type { MetadataRoute } from "next";

/* HIDDEN FOR THE DEMO — /o-nama is not listed while it redirects. Add it
   back here when the story goes live. */
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
  ];
}
