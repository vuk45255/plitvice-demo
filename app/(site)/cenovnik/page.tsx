import type { Metadata } from "next";
import { PriceListPage } from "@/components/drinks/price-list-page";

export const metadata: Metadata = {
  title: "Cenovnik",
  description:
    "Cenovnik pića kluba Plitvice u Inđiji — flaše, koktele i sve ostalo sa bara.",
  openGraph: {
    title: "Cenovnik — Plitvice",
    description: "Šta se pije u Plitvicama. Cenovnik bara, Inđija.",
    url: "/cenovnik",
  },
};

export default function Cenovnik() {
  return <PriceListPage />;
}
