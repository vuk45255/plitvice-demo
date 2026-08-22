import type { MessageKey } from "@/lib/i18n";
import { site } from "@/lib/site";

/* The concierge: the six things a visitor coming into Inđija for a night at
   Plitvice actually has to solve — a bed, a meal, a shop that is still open, a
   ride, a chemist, and the road here.
 *
 * One list drives both halves of the section. The pinned intro reads it in
 * order and asks a question per entry; the grid below lays the same six out as
 * cards. There is no second copy of the order anywhere, so the two can never
 * drift apart.
 *
 * `image` is a path under /public rather than a static import on purpose. None
 * of these photographs exist in the repository yet — see the note on ASSETS
 * below — and a static import of a missing file will not build. A plain path
 * lets the card fall back to its own drawn plate until the file is dropped in,
 * and pick the photograph up with no code change the moment it is. */

export type InfoCategory = {
  id: string;
  /* The card's name, and the word the intro asks its question with. The two are
     different words in Serbian — a card says RESTORANI, the question asks
     RESTORAN? — so each entry carries both. */
  name: MessageKey;
  asking: MessageKey;
  /* Alt text for the photograph. Written to be read aloud. */
  alt: MessageKey;
  image: string;
  /* The two lights in the drawn plate this category falls back to while its
     photograph is missing — see components/local-info/info-photo.tsx. Six
     different rooms should not all be lit the same way, or the intro reads as
     one slide shown six times. Every one of them is inside the house palette:
     violet through plum through indigo, with the club's gold on the far side.
     They stop mattering the moment the real photographs land. */
  tint: [string, string];
  /* Where the card goes. `null` is a category with nowhere to send anyone yet:
     it renders as a figure rather than as a link, so nothing announces itself
     to a screen reader as a door that does not open. Give it an href and it
     becomes a real link, with the focus treatment, on the spot. */
  href: string | null;
};

/* ASSETS — every path below is expected at /public/info/<id>.jpg and none of
   them are in the repository yet. Landscape, 3:2 or wider, is the shape the
   intro wants; the cards crop square out of the middle of it. */
export const INFO: InfoCategory[] = [
  {
    id: "smestaj",
    name: "info.smestaj",
    asking: "info.ask.smestaj",
    alt: "info.alt.smestaj",
    image: "/info/smestaj.jpg",
    tint: ["rgba(126,74,186,0.58)", "rgba(200,164,93,0.26)"],
    href: null,
  },
  {
    id: "restorani",
    name: "info.restorani",
    asking: "info.ask.restorani",
    alt: "info.alt.restorani",
    image: "/info/restorani.jpg",
    tint: ["rgba(176,58,120,0.46)", "rgba(200,164,93,0.34)"],
    href: null,
  },
  {
    id: "nonstop",
    name: "info.nonstop",
    asking: "info.ask.nonstop",
    alt: "info.alt.nonstop",
    image: "/info/nonstop.jpg",
    tint: ["rgba(64,96,190,0.52)", "rgba(120,200,190,0.22)"],
    href: null,
  },
  {
    id: "prevoz",
    name: "info.prevoz",
    asking: "info.ask.prevoz",
    alt: "info.alt.prevoz",
    image: "/info/prevoz.jpg",
    tint: ["rgba(92,66,168,0.5)", "rgba(214,142,64,0.28)"],
    href: null,
  },
  {
    id: "prva-pomoc",
    name: "info.prvaPomoc",
    asking: "info.ask.prvaPomoc",
    alt: "info.alt.prvaPomoc",
    image: "/info/prva-pomoc.jpg",
    tint: ["rgba(58,86,150,0.46)", "rgba(190,72,96,0.24)"],
    href: null,
  },
  {
    /* The one category the site can already answer: the map on the home page
       is the club's own address, and it is a real door rather than an invented
       one. Everything above waits for a page of its own. */
    id: "kako-do-nas",
    name: "info.kakoDoNas",
    asking: "info.ask.kakoDoNas",
    alt: "info.alt.kakoDoNas",
    image: "/info/kako-do-nas.jpg",
    tint: ["rgba(104,62,158,0.54)", "rgba(200,164,93,0.3)"],
    href: "#location",
  },
];

/* The house map, for anyone who wants the route rather than the section. */
export const routeUrl = site.mapsUrl;
