import type { StaticImageData } from "next/image";

import posterDara from "@/public/party/dara.jpg";
import posterTeodora from "@/public/party/teodora.jpg";
import posterThcf from "@/public/party/thcf.jpg";
import posterRelja from "@/public/party/relja.jpg";
import posterRasta from "@/public/party/rasta.jpg";
import posterInas from "@/public/party/inas.jpg";
import posterSemafor from "@/public/party/semafor.jpg";
import posterNumber from "@/public/party/53.jpg";
import posterSajfer from "@/public/images/sajfer.jpg";
import posterKaca from "@/public/dogadjaji/kaca.jpg";
import posterVodka from "@/public/dogadjaji/vodka.jpg";
import posterMadness from "@/public/dogadjaji/madness.jpg";

/* THE ARTWORK THAT SHIPS WITH THE BUILD, AND THE LIGHT IT THROWS.
 *
 * ═══ WHY A REGISTRY AND NOT JUST A URL ════════════════════════════════════
 *
 * A night's poster is now a string on its database row — `/dogadjaji/madness.jpg`
 * for a picture that came with the repository, `https://…` for one somebody
 * uploaded from the office. Those two are not interchangeable to next/image:
 * importing a file gives a `StaticImageData` carrying its real dimensions and a
 * blur placeholder the bundler computed at build time, and that placeholder is
 * what makes every poster on this site fade up out of its own colour instead of
 * snapping in. A plain string cannot have one.
 *
 * So the path on the row is looked up here. A picture that is in the build
 * resolves to the imported asset and keeps its blur-up exactly as before; a
 * picture that is not — an uploaded poster on a CDN — is handed back as the URL
 * it is, and the components that render it fall back to no placeholder. NOTHING
 * ABOUT THE EXISTING WALL CHANGES, and an uploaded poster works the day the
 * club uploads one.
 *
 * ═══ AMBIENT LIVES HERE BECAUSE IT IS A FACT ABOUT THE PICTURE ════════════
 *
 * The colour a night throws into the room around it was sampled off the artwork
 * itself — it is not a brand colour, not a theme, and not something an office
 * screen should be asking somebody to type in a hex field. It belongs to the
 * file, so it is filed with the file. An uploaded poster simply has none, and
 * the room stands in the house's own light, which is the state that was already
 * written for a night with no ambient set.
 *
 * ═══ THIS IS DATA, NOT LOGIC ══════════════════════════════════════════════
 *
 * Adding a picture here is adding a line. Nothing reads a slug, nothing branches
 * on a venue, and the day a second club has its own artwork it gets its own
 * registry rather than an `if`. */

export type PosterAsset = {
  image: StaticImageData;
  /* A plain CSS hex, sampled off the artwork. Absent means the poster stands in
     the house's own light and no glow is drawn behind it. */
  ambient?: string;
};

/* Keyed by the path stored on the event row. */
export const POSTER_ASSETS: Record<string, PosterAsset> = {
  /* The artwork is silver and all but colourless — mean saturation under seven
     per cent — so what it throws into the room is the cold white off the print
     itself rather than a colour. */
  "/dogadjaji/madness.jpg": { image: posterMadness, ambient: "#c9c7c6" },
  /* The cold blue off the bottle and the sky behind it. */
  "/dogadjaji/vodka.jpg": { image: posterVodka, ambient: "#6ea3d5" },
  "/dogadjaji/kaca.jpg": { image: posterKaca },
  "/party/dara.jpg": { image: posterDara },
  "/party/rasta.jpg": { image: posterRasta },
  "/party/semafor.jpg": { image: posterSemafor },
  "/party/teodora.jpg": { image: posterTeodora },
  "/party/thcf.jpg": { image: posterThcf },
  "/party/relja.jpg": { image: posterRelja },
  "/party/inas.jpg": { image: posterInas },
  "/party/53.jpg": { image: posterNumber },
  "/images/sajfer.jpg": { image: posterSajfer },
};

/* What a component may hand to `next/image`. A bundled asset carries its own
   dimensions and blur; a URL is just a URL. */
export type Poster = StaticImageData | string;

export type ResolvedPoster = { image: Poster; ambient?: string };

/* The artwork for a path off an event row: the bundled asset when the picture
   came with the build, the URL itself when it did not, and nothing at all when
   the night has no poster. */
export function posterFor(image: string | undefined): ResolvedPoster | undefined {
  if (!image) return undefined;
  return POSTER_ASSETS[image] ?? { image };
}

/* True when the poster came with the build and therefore has a blur placeholder
   the bundler computed. Components ask this rather than sniffing the value, so
   there is one answer to "may I pass placeholder=blur". */
export function isBundled(poster: Poster): poster is StaticImageData {
  return typeof poster !== "string";
}
