import type { Metadata } from "next";
import { ReservationGate } from "@/components/reservation/reservation-gate";
import { ReservationRoom } from "@/components/reservation/reservation-room";
import { programme } from "@/lib/club/programme";
import type { ReserveChoice } from "@/lib/events";

export const metadata: Metadata = {
  title: "Rezervacija",
  description:
    "Karte i stolovi za žurke u klubu Plitvice, Inđija. Izaberite žurku, pa kartu ili sto.",
  openGraph: {
    title: "Rezervacija — Plitvice",
    description:
      "Karte i stolovi za žurke u klubu Plitvice, Inđija. Izaberite žurku, pa kartu ili sto.",
    url: "/rezervacija",
  },
};

/* The room is opened with the night already chosen whenever the link carried
   one — from a poster on the wall, from the archive, from anywhere. The query
   is read here, on the server, so a shared link renders correctly on arrival
   rather than snapping into place after hydration. */
/* The nights are read here, on the server, from the events table. A draft, an
   archived night and a fixture never leave this function — see `isPublic` in
   lib/club/programme.ts — so the selector below can only offer what the office
   published, and a hand-typed ?event= for a draft finds nothing. */
export const dynamic = "force-dynamic";

export default async function Rezervacija(props: PageProps<"/rezervacija">) {
  const params = await props.searchParams;
  const { upcoming } = await programme();

  const event = typeof params.event === "string" ? params.event : undefined;
  const asked = typeof params.izbor === "string" ? params.izbor : undefined;
  const choice: ReserveChoice | undefined =
    asked === "karte" || asked === "stolovi" ? asked : undefined;

  /* The room is rendered whole, and the admission notice is laid over it —
     the guest reads the conditions with the night they came for already
     visible behind the glass. Nothing about the room itself changes. */
  return (
    <>
      <ReservationRoom events={upcoming} initialSlug={event} initialChoice={choice} />
      <ReservationGate />
    </>
  );
}
