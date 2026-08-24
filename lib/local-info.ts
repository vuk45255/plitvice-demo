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
 * `image` is a path under /public rather than a static import on purpose: a
 * plain path lets the card fall back to its own drawn plate if a file is ever
 * missing, where a static import of one would not build at all. */

export type InfoCategory = {
  id: string;
  /* The card's name, and the word the intro asks its question with. The two are
     different words in Serbian — a card says RESTORANI, the question asks
     RESTORAN? — so each entry carries both. */
  name: MessageKey;
  asking: MessageKey;
  /* Alt text for the photograph. Written to be read aloud. */
  alt: MessageKey;
  /* The last segment of the page behind the card. Kept separate from the id
     because one of the six reads better in a URL with a hyphen in it than the
     id does without one. */
  slug: string;
  image: string;
  /* WHERE THE SUBJECT IS, as an object-position. The six photographs are not
     one shape — four are portrait and two are landscape — and the card crops a
     square out of every one of them, so a centred crop would take the ceiling
     out of some and the table out of others. Each of these is measured off its
     own frame: the bed, the laid table, the lit shopfront, the car, the
     entrance under the cross, the road into town. They are the reason no card
     shows the empty half of its picture. */
  focus: string;
  /* The two lights in the drawn plate this category falls back to if its
     photograph ever fails to load — see components/local-info/info-photo.tsx.
     Six different rooms should not all be lit the same way, or the intro reads
     as one slide shown six times. Every one of them is inside the house
     palette: violet through plum through indigo, with the club's gold on the
     far side. */
  tint: [string, string];
};

/* ASSETS — the six photographs are in /public/info. The file names are the
   ones they were delivered under rather than the ids below, so the two are
   written out separately here; renaming the files is not worth the churn.
   Every one of them is cropped rather than shown whole — the cards take a
   square, the intro takes the screen — which is what `focus` is for. */
export const INFO: InfoCategory[] = [
  {
    id: "smestaj",
    slug: "smestaj",
    name: "info.smestaj",
    asking: "info.ask.smestaj",
    alt: "info.alt.smestaj",
    image: "/info/smestaj.png",
    focus: "50% 55%",
    tint: ["rgba(126,74,186,0.58)", "rgba(200,164,93,0.26)"],
  },
  {
    id: "restorani",
    slug: "restorani",
    name: "info.restorani",
    asking: "info.ask.restorani",
    alt: "info.alt.restorani",
    image: "/info/restoran.png",
    focus: "50% 78%",
    tint: ["rgba(176,58,120,0.46)", "rgba(200,164,93,0.34)"],
  },
  {
    id: "nonstop",
    slug: "non-stop",
    name: "info.nonstop",
    asking: "info.ask.nonstop",
    alt: "info.alt.nonstop",
    image: "/info/nonstopshop.png",
    focus: "50% 18%",
    tint: ["rgba(64,96,190,0.52)", "rgba(120,200,190,0.22)"],
  },
  {
    id: "prevoz",
    slug: "prevoz",
    name: "info.prevoz",
    asking: "info.ask.prevoz",
    alt: "info.alt.prevoz",
    image: "/info/prevoz.png",
    focus: "50% 65%",
    tint: ["rgba(92,66,168,0.5)", "rgba(214,142,64,0.28)"],
  },
  {
    id: "prva-pomoc",
    slug: "prva-pomoc",
    name: "info.prvaPomoc",
    asking: "info.ask.prvaPomoc",
    alt: "info.alt.prvaPomoc",
    image: "/info/hitnapomoc.png",
    focus: "40% 50%",
    tint: ["rgba(58,86,150,0.46)", "rgba(190,72,96,0.24)"],
  },
  {
    id: "kako-do-nas",
    slug: "kako-do-nas",
    name: "info.kakoDoNas",
    asking: "info.ask.kakoDoNas",
    alt: "info.alt.kakoDoNas",
    image: "/info/kakodonas.png",
    focus: "55% 50%",
    tint: ["rgba(104,62,158,0.54)", "rgba(200,164,93,0.3)"],
  },
];

/* The house map, for anyone who wants the route rather than the section. */
export const routeUrl = site.mapsUrl;

/* Where a card goes. Written once, so the grid, the sitemap and any link
   added later can never disagree about it. What the pages themselves hold is
   in lib/info-places.ts, keyed by the ids above. */
export function infoHref(category: InfoCategory) {
  return `/info/${category.slug}`;
}

export function categoryBySlug(slug: string) {
  return INFO.find((entry) => entry.slug === slug);
}
