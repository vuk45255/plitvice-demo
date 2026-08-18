import type { Metadata } from "next";
import { AtmosferaPage } from "@/components/archive/atmosfera-page";

export const metadata: Metadata = {
  title: "Atmosfera",
  description:
    "Atmosfera kluba Plitvice u Inđiji — sala, svetla, muzika i ljudi. Fotografije iz noći koje se pamte.",
  openGraph: {
    title: "Atmosfera — Plitvice",
    description:
      "Sala, svetla i ljudi u jednoj prostoriji. Atmosfera kluba Plitvice, Inđija.",
    url: "/atmosfera",
  },
};

export default function Atmosfera() {
  return <AtmosferaPage />;
}
