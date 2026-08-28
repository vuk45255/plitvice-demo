/* The bottles on the back bar — the marks that drift through the band between
   the concierge and the address on the home page.
 *
 * The artwork is the club's own five brand marks, prepared into
 * `public/pice/` by `scripts/prepare-drink-marks.mjs` from the raw files in
 * `public/CENOVNIK/`: keyed off their backgrounds, set in the house warm
 * white, trimmed to their own ink. See `public/pice/README.md` for the spec
 * and that script's header for why the raw files needed the work.
 *
 * The order is the order they pass in.
 *
 * EVERY NUMBER BELOW IS A SHARE OF THE BAND'S OWN HEIGHT, never a pixel. That
 * is the whole reason the band needs one breakpoint and not three: `--band`
 * changes on the section, and the composition — how tall each mark stands,
 * how far off the centre line it sits, how much air follows it — comes with
 * it at exactly the same proportions on a phone as on a desk. */

export type DrinkMark = {
  /* The name on the bottle. Not rendered — the marks are decorative and the
     whole moving layer is `aria-hidden` — but it is what the file is called
     and what the order is read in. */
  name: string;
  /* Prepared artwork: transparent PNG, house warm white, margin cropped. */
  src: string;
  /* The prepared file's own pixel size. Both are needed: they are what holds
     the mark's box open at the right width before the image has loaded, so a
     lazily-loaded run never reflows and never jolts the loop. */
  width: number;
  height: number;
  /* How tall it stands, as a share of the band. Tuned against each mark's own
     proportions rather than set flat: a wide script like Dom Pérignon at the
     height of a tall seal like Old No. 7 would be twice anything else in the
     run. What is being evened out here is the width they each end up at. */
  scale: number;
  /* How far off the centre line it sits, positive downward. Small, alternating
     and deliberately unequal — this is the difference between a composition
     and five things on a shelf. Kept inside +/-0.08 so nothing collides with
     the fade at the top or bottom of the band. */
  drift: number;
  /* How far up out of the dark it comes. The thin scripts carry a little more
     than the solid figures, which is what makes them read as the same weight
     of light. */
  opacity: number;
  /* The air after it, before the next mark. */
  gap: number;
};

export const drinkMarks: DrinkMark[] = [
  {
    name: "Jack Daniel's",
    src: "/pice/jack.png",
    width: 760,
    height: 464,
    scale: 0.72,
    drift: -0.04,
    opacity: 0.34,
    gap: 0.3,
  },
  {
    name: "Dom Pérignon",
    src: "/pice/dom.png",
    width: 800,
    height: 281,
    scale: 0.42,
    drift: 0.07,
    opacity: 0.42,
    gap: 0.34,
  },
  {
    name: "Moët & Chandon",
    src: "/pice/moet.png",
    width: 476,
    height: 163,
    scale: 0.4,
    drift: -0.06,
    opacity: 0.4,
    gap: 0.32,
  },
  {
    name: "Johnnie Walker",
    src: "/pice/walker.png",
    width: 900,
    height: 621,
    scale: 0.76,
    drift: 0.03,
    opacity: 0.3,
    gap: 0.28,
  },
  {
    name: "Grey Goose",
    src: "/pice/greygoose.png",
    width: 394,
    height: 308,
    scale: 0.74,
    drift: -0.05,
    opacity: 0.32,
    gap: 0.34,
  },
];
