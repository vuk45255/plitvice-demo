import type { Metadata } from "next";
import { TrenutciPage } from "@/components/archive/trenutci-page";

export const metadata: Metadata = {
  title: "Trenutci",
  description:
    "Vizuelna arhiva kluba Plitvice u Inđiji — kuća na ćošku, posebne noći i detalji, od 1965. do danas.",
  openGraph: {
    title: "Trenutci — Plitvice",
    description:
      "Vizuelna arhiva kluba Plitvice, Inđija. Od 1965. do danas.",
    url: "/trenutci",
  },
};

export default function Trenutci() {
  return <TrenutciPage />;
}
