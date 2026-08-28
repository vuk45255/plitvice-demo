import type { Metadata } from "next";
import { AboutPage } from "@/components/story/about-page";

export const metadata: Metadata = {
  title: "O nama",
  description:
    "Plitvice od 1965. godine. Priča o klubu u Inđiji kroz generacije — ista sala, isti naziv, nova energija.",
  openGraph: {
    title: "O nama — Plitvice",
    description:
      "Od 1965. godine. Ista sala pamti šezdesete, devedesete i sinoć. Godine se smenjuju, ime ostaje isto.",
    url: "/o-nama",
  },
};

export default function ONama() {
  return <AboutPage />;
}
