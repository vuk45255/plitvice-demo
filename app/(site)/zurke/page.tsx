import type { Metadata } from "next";
import { ZurkePage } from "@/components/archive/zurke-page";

export const metadata: Metadata = {
  title: "Žurke",
  description:
    "Sve žurke kluba Plitvice u Inđiji — naredna subota i arhiva prošlih noći. Rezervišite sto na vreme.",
  openGraph: {
    title: "Žurke — Plitvice",
    description:
      "Naredna žurka i arhiva svih noći u klubu Plitvice, Inđija.",
    url: "/zurke",
  },
};

export default function Zurke() {
  return <ZurkePage />;
}
