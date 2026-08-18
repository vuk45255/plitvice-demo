import type { StaticImageData } from "next/image";
import type { MessageKey } from "@/lib/i18n";

/* The photography the three portals and their archive pages show.
 *
 * The nights themselves live in lib/events.ts — this file is only the room:
 * what the club looks like, and what stays. Real stills from /public, nothing
 * borrowed and nothing stock. */

import shotCrowd from "@/public/instagram/469059425_18476195971044345_4235207755024478138_n.jpg";
import shotLights from "@/public/instagram/469127602_18476195941044345_2574816115416059072_n.jpg";
import shotBooth from "@/public/instagram/470425204_18478972765044345_1296011379318529129_n.jpg";

/* A single photograph. The caption doubles as the alt text — the lines are
   written to work read aloud as well as set under a picture. */
export type Frame = {
  src: StaticImageData;
  caption: MessageKey;
};

/* The room itself: crowd, lights, the booth. */
export const atmosfera: Frame[] = [
  { src: shotCrowd, caption: "shot.crowd" },
  { src: shotLights, caption: "shot.lights" },
  { src: shotBooth, caption: "shot.booth" },
];

/* The two clips the club posted itself — the same files the feed at the bottom
   of the page plays, referenced rather than copied. Both the Trenutci window on
   the home page and the whole of /trenutci run this one list, so the two can
   never fall out of step. */
export const trenutciClips = [
  "/instagram/instagram-1-small.mp4",
  "/instagram/instagram-2-small.mp4",
];
