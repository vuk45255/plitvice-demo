import type { Metadata } from "next";
import { ZurkePage } from "@/components/archive/zurke-page";
import { programme } from "@/lib/club/programme";

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

/* The programme is data now, so this page is rendered per request rather than
   frozen at build time — a night published from the office has to be on the
   wall before the next deploy. */
export const dynamic = "force-dynamic";

export default async function Zurke() {
  /* THE WALL, NOT THE WHOLE RECORD. `archive` is the record with the club's
     own nights given the frames first and the older posters filling whatever
     is left — see ARCHIVE_SLOTS in lib/club/programme.ts. */
  const { next, archive } = await programme();
  return <ZurkePage next={next} past={archive} />;
}
