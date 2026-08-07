import type { Metadata } from "next";
import { ReservationPage } from "@/components/reservation/reservation-page";

export const metadata: Metadata = {
  title: "Rezervacija",
  description:
    "Rezervišite sto u klubu Plitvice, Inđija. Vi okupite ekipu, ostalo prepustite nama.",
  openGraph: {
    title: "Rezervacija — Plitvice",
    description:
      "Rezervišite sto u klubu Plitvice, Inđija. Vi okupite ekipu, ostalo prepustite nama.",
    url: "/rezervacija",
  },
};

/* The same room as the overlay, standing on its own — for the link shared in
   a message, the QR on a flyer, or a visitor arriving straight here. Inside
   the site the reservation is an overlay instead, so the hero's entrance
   ceremony is never replayed on the way back. */
export default function Rezervacija() {
  return <ReservationPage />;
}
