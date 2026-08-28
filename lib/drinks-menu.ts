import type { Lang } from "@/lib/i18n";

/* THE CENOVNIK — every drink the bar sells, and what it costs.
 *
 * THIS FILE IS THE ONLY PLACE A PRICE IS WRITTEN. Nothing on /cenovnik is
 * hand-set in JSX; the page reads this list and draws it. To change a price,
 * change the number here and nowhere else. To add a drink, add a row to its
 * category. To add a category, add one to the array — the layout picks it up
 * on its own, including which column it falls in.
 *
 * The numbers are the club's own, transcribed from the printed list. They are
 * written the way Serbia writes them: a full stop for thousands (13.000) and
 * a comma for the decimal in a volume (0,75). Both are therefore STRINGS, not
 * numbers — a price is a piece of typography here, not something the page
 * ever does arithmetic on, and putting 13000 through a locale formatter at
 * render time would be a way to get it wrong for no gain.
 *
 * Product names are proper nouns and are never translated. Category headings
 * are, so each carries both. They live here rather than in lib/i18n.ts on
 * purpose: the heading and the rows under it are one thing, and splitting
 * them across two files is how a category gets renamed in one and not the
 * other. */

export type PriceItem = {
  /* The name on the bottle, exactly as the club writes it. */
  name: string;
  /* What is poured, in litres, as printed: "0,03" for a measure, "0,7" for a
     bottle. Rendered in parentheses after the name. */
  volume: string;
  /* Dinars. A string — see the note above. */
  price: string;
  /* Opens a little air above this row. Used where one category holds two
     kinds of thing: the glass of wine and the bottle of it, the measure of
     vodka and the bottle of it. It adds NO words to the page — it is a space,
     and the volume beside each row is what actually says which is which. */
  group?: boolean;
};

export type PriceCategory = {
  /* Stable id — the anchor, and the React key. */
  id: string;
  title: Record<Lang, string>;
  /* Which of the two desktop columns it stands in. On a phone the columns
     collapse and the categories run in the order they appear below. */
  column: 1 | 2;
  /* The brand mark that stands behind this category, if one does. Five of the
     twelve carry one; the rest are meant to be empty, because a mark behind
     every heading is wallpaper rather than a composition. */
  mark?: MarkId;
  items: PriceItem[];
};

export const priceList: PriceCategory[] = [
  {
    id: "vode",
    title: { sr: "Vode", en: "Water" },
    column: 1,
    items: [
      { name: "Rosa gazirana voda", volume: "0,25", price: "180" },
      { name: "Rosa negazirana voda", volume: "0,25", price: "180" },
    ],
  },
  {
    id: "sokovi",
    title: { sr: "Sokovi", en: "Soft drinks" },
    column: 1,
    items: [
      { name: "Coca Cola", volume: "0,25", price: "195" },
      { name: "Fanta", volume: "0,25", price: "195" },
      { name: "Sprite", volume: "0,25", price: "195" },
      { name: "Schweppes Bitter", volume: "0,25", price: "195" },
      { name: "Schweppes Tonic", volume: "0,25", price: "195" },
      { name: "Next sokovi", volume: "0,20", price: "195" },
    ],
  },
  {
    id: "piva",
    title: { sr: "Piva", en: "Beer" },
    column: 1,
    items: [
      { name: "Zaječarsko", volume: "0,33", price: "200" },
      { name: "Laško", volume: "0,33", price: "280" },
      { name: "Birra Moretti", volume: "0,33", price: "280" },
      { name: "Heineken", volume: "0,25", price: "310" },
      { name: "Sol", volume: "0,33", price: "400" },
    ],
  },
  {
    id: "penusava-vina",
    title: { sr: "Penušava vina", en: "Sparkling wine" },
    column: 1,
    mark: "dom",
    items: [
      { name: "Prosecco", volume: "0,75", price: "3.500" },
      { name: "Moët", volume: "0,75", price: "13.000" },
      { name: "Moët Ice", volume: "0,75", price: "17.500" },
      { name: "Dom Perignon", volume: "0,75", price: "40.000" },
    ],
  },
  {
    id: "vina",
    title: { sr: "Vina", en: "Wine" },
    column: 1,
    mark: "moet",
    items: [
      { name: "Belo vino", volume: "0,187", price: "280" },
      { name: "Crno vino", volume: "0,187", price: "280" },
      { name: "Sangria", volume: "0,187", price: "280" },
      { name: "Rose", volume: "0,187", price: "280" },

      { name: "Belo vino", volume: "0,7", price: "2.000", group: true },
      { name: "Crno vino", volume: "0,7", price: "2.000" },
      { name: "Rose", volume: "0,7", price: "2.000" },

      { name: "Kovačević Chardonnay", volume: "0,7", price: "3.300", group: true },
      { name: "Kovačević Roseto", volume: "0,7", price: "3.200" },
      { name: "Kovačević Aurelius", volume: "0,7", price: "3.800" },
    ],
  },
  {
    id: "votka",
    title: { sr: "Votka", en: "Vodka" },
    column: 2,
    mark: "greygoose",
    items: [
      { name: "Domaća vodka (za mikseve)", volume: "0,03", price: "200" },
      { name: "Finlandia", volume: "0,03", price: "260" },

      { name: "Grey Goose", volume: "0,7", price: "12.000", group: true },
      { name: "Grey Goose", volume: "1,5", price: "25.000" },
    ],
  },
  {
    id: "viski",
    title: { sr: "Viski", en: "Whisky" },
    column: 2,
    mark: "walker",
    items: [
      { name: "Johnnie Walker", volume: "0,03", price: "260" },
      { name: "Jack Daniels", volume: "0,03", price: "300" },
      { name: "Gentlemen Jack", volume: "0,03", price: "420" },
      { name: "Jack Daniels (single barel)", volume: "0,03", price: "550" },
      { name: "Jack Daniels Gold", volume: "0,03", price: "900" },
      { name: "Macallan 12 YO", volume: "0,03", price: "690" },
      { name: "Remy Martin VSOP", volume: "0,03", price: "450" },
    ],
  },
  {
    id: "rakije",
    title: { sr: "Rakije", en: "Rakija" },
    column: 2,
    mark: "jack",
    items: [
      { name: "Zlatna Dunja", volume: "0,03", price: "230" },
      { name: "Zlatna Kajsija", volume: "0,03", price: "230" },
      { name: "Zlatna Viljamovka", volume: "0,03", price: "230" },
      { name: "Zlatni Pelin", volume: "0,03", price: "200" },
      { name: "Meduška", volume: "0,03", price: "200" },
      { name: "Zlatna Šljiva", volume: "0,03", price: "230" },
    ],
  },
  {
    id: "tekile",
    title: { sr: "Tekile", en: "Tequila" },
    column: 2,
    items: [
      { name: "Camino Blanco", volume: "0,03", price: "260" },
      { name: "El. Jimador Blanco", volume: "0,03", price: "330" },
      { name: "El. Jimador (Gold)", volume: "0,03", price: "340" },
      { name: "Patron", volume: "0,03", price: "535" },
    ],
  },
  {
    id: "dzin",
    title: { sr: "Džin", en: "Gin" },
    column: 2,
    items: [
      { name: "Bombay", volume: "0,03", price: "280" },
      { name: "Bombay Sunset", volume: "0,03", price: "300" },
      { name: "The Botanist", volume: "0,03", price: "430" },
    ],
  },
  {
    id: "ostala-zestoka",
    title: { sr: "Ostala žestoka pića", en: "Other spirits" },
    column: 2,
    items: [
      { name: "Campari", volume: "0,03", price: "250" },
      { name: "Martini Bianco", volume: "0,03", price: "250" },
      { name: "Martini Rosso", volume: "0,03", price: "250" },
      { name: "Absinth", volume: "0,03", price: "250" },
      { name: "Vermut", volume: "0,03", price: "200" },
      { name: "Jegermeister", volume: "0,03", price: "260" },
    ],
  },
  {
    id: "energetski-napici",
    title: { sr: "Energetski napici", en: "Energy drinks" },
    column: 2,
    items: [
      { name: "Ultra Energy", volume: "0,25", price: "250" },
      { name: "Red Bull", volume: "0,25", price: "390" },
    ],
  },
];

/* ── THE ARTWORK ───────────────────────────────────────────────────────────
 *
 * The five brand marks the club owns, standing behind the categories they
 * belong to: Dom Pérignon and Moët over the wines, Grey Goose over the vodka,
 * Johnnie Walker and Jack Daniel's over the whisky and the rakija beside it.
 *
 * THESE ARE THE PREPARED FILES IN public/pice/, not the raw ones in
 * public/CENOVNIK/. Same artwork — the raw files are brand wordmarks sitting
 * on their own opaque backgrounds, and dropping a white rectangle onto a
 * purple-black page is not a way to make anything feel expensive. The
 * prepared set is keyed out, set in the house warm white and trimmed to its
 * own ink by scripts/prepare-drink-marks.mjs, which is what lets a mark bleed
 * off the edge of the screen instead of ending at a seam. The band on the
 * home page draws from exactly the same files.
 *
 * NOTHING HERE IS THE SAME SIZE OR IN THE SAME PLACE AS ANYTHING ELSE. That
 * is the entire point — five marks at one size down one edge is a column of
 * logos, not a composition. `size` is clamped against the viewport so a mark
 * keeps its share of a phone and stops growing on a very wide screen; `lift`
 * is how far it sits off its category's own top edge; `ink` is how far up out
 * of the dark it comes, before the page halves it again on small screens.
 *
 * Each mark fades out toward the text — see MASK in the price list — so the
 * side it stands on is the side it is solid on, and the menu is always read
 * against the room rather than against a bottle. */

export type MarkId = "jack" | "dom" | "moet" | "walker" | "greygoose";

export type MenuMark = {
  src: string;
  /* The prepared file's own pixels. Both are needed so the box is the right
     shape before the image has loaded and the list never reflows under it. */
  width: number;
  height: number;
  /* The edge it bleeds off. */
  side: "left" | "right";
  /* How wide it is drawn. */
  size: string;
  /* How far it sits off the top of its category. */
  lift: string;
  /* How far up out of the dark it comes, at full size. */
  ink: number;
  /* How far it drifts against the scroll, in pixels, across the whole page.
     Signed, small, and different for every mark — this is the parallax, and
     it is meant to be felt rather than seen. */
  drift: number;
};

export const menuMarks: Record<MarkId, MenuMark> = {
  /* Dom Pérignon — the widest script and the most expensive bottle on the
     list, so it gets the largest presence on the page. */
  dom: {
    src: "/pice/dom.png",
    width: 800,
    height: 281,
    side: "left",
    size: "min(56vw, 620px)",
    lift: "-3.5rem",
    ink: 0.17,
    drift: -34,
  },
  /* Moët, further down and smaller — the second champagne, reading as though
     it stands behind the first. */
  moet: {
    src: "/pice/moet.png",
    width: 476,
    height: 163,
    side: "left",
    size: "min(40vw, 430px)",
    lift: "9rem",
    ink: 0.13,
    drift: 22,
  },
  /* Grey Goose, opposite and high — the first thing the right-hand column
     stands under. */
  greygoose: {
    src: "/pice/greygoose.png",
    width: 394,
    height: 308,
    side: "right",
    size: "min(32vw, 330px)",
    lift: "-2rem",
    ink: 0.15,
    drift: 28,
  },
  /* Johnnie Walker — the tallest figure in the set, over the longest
     category on the page. */
  walker: {
    src: "/pice/walker.png",
    width: 900,
    height: 621,
    side: "right",
    size: "min(48vw, 500px)",
    lift: "1.5rem",
    ink: 0.11,
    drift: -26,
  },
  /* Old No. 7, last and lowest, small enough to close the page rather than
     restate it. */
  jack: {
    src: "/pice/jack.png",
    width: 760,
    height: 464,
    side: "right",
    size: "min(34vw, 360px)",
    lift: "5rem",
    ink: 0.12,
    drift: 18,
  },
};
