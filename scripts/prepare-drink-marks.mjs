/* Turns the raw brand artwork in `public/CENOVNIK/` into the back bar's marks
   in `public/pice/`, to the spec already written down in `public/pice/README.md`:
   transparent PNG, pale ink on nothing, transparent margin cropped off.
 *
 * It has to exist because of what the raw files actually are. Three of the
 * five (jack, dom, greygoose) were saved out of a transparent-PNG preview, so
 * the grey-and-white checkerboard that was standing in for transparency is
 * painted into their pixels — 84% of `jack` is literally two shades of grey in
 * a grid. And all five are dark ink: black script, navy, gold. Dropped
 * straight onto the room's purple-black they would read as three grey
 * rectangles and two invisible ones.
 *
 * So, per file: recover the alpha the checkerboard replaced, throw the colour
 * away, and set the mark in the house warm white. What comes out is what the
 * README asked for in the first place.
 *
 *   node scripts/prepare-drink-marks.mjs
 *
 * The originals in `public/CENOVNIK/` are never written to. Re-run it after
 * dropping a better source in — a genuinely transparent file skips the keying
 * and only gets recoloured and trimmed. */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "public", "CENOVNIK");
const OUT = path.join(ROOT, "public", "pice");

/* The house warm white — `--night-ink` in app/globals.css. The band dims it to
   about a third, so it is set at full strength here. */
const INK = { r: 244, g: 240, b: 230 };

/* Where the checkerboard lives. Measured, not guessed: across the three
   flattened files its two squares are 255 and 219-235, and the darkest thing
   that belongs to a logo is Dom Perignon's gold at 166. The window sits in
   that gap — opaque at or below BG_FULL, gone at or above BG_NONE, and eased
   across the twenty levels between so edges stay anti-aliased. */
const BG_NONE = 214;
const BG_FULL = 194;
/* The checkerboard is grey. Anything with colour in it is artwork, whatever
   its brightness — this is what keeps the gold. */
const BG_MAX_CHROMA = 10;

/* Rasterise vectors well above the ~340px the band ever shows, so the mark is
   still clean on a 3x screen. */
const SVG_WIDTH = 1400;
/* Everything lands at 2x the largest the band draws it. */
const MAX_SIDE = 900;

const SOURCES = [
  { name: "jack", file: "jack.jpg" },
  { name: "dom", file: "dom.jpg" },
  { name: "moet", file: "moet.jpg" },
  { name: "walker", file: "walker.jpg" },
  { name: "greygoose", file: "greygoose.jpg" },
];

const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const clamp01 = (n) => (n < 0 ? 0 : n > 1 ? 1 : n);

/* The alpha the file already carries, if it carries any worth having. A source
   that is a fifth transparent was exported properly and is left alone. */
function existingAlpha(data, px, channels) {
  const alpha = new Uint8Array(px);
  let clear = 0;
  for (let i = 0; i < px; i++) {
    const a = data[i * channels + 3];
    alpha[i] = a;
    if (a < 20) clear++;
  }
  return clear / px > 0.2 ? alpha : null;
}

/* Recovering the alpha a checkerboard is standing in for.
 *
 * The one thing worth knowing before trusting this: in all three flattened
 * files the checkerboard shows through the *inside* of the artwork too — the
 * hollow of Jack Daniel's Old No. 7 seal and the counters of GREY GOOSE's
 * lettering are both 255/235 grid, not white ink. So there is no pale region
 * anywhere in these files that belongs to a logo, and the key can be a plain
 * per-pixel test. Reaching for connectivity instead — flooding in from the
 * border so enclosed regions survive — is the tempting mistake: the seal is
 * walled in by its own black outline, the flood never gets inside it, and it
 * fills in as a solid white blob.
 *
 * Two ways a pixel earns its opacity, and it takes the better of them:
 * darkness, which carries the black and navy ink, and colour, which carries
 * Dom Perignon's gold at a brightness the checkerboard also sits at. Both are
 * ramps rather than cutoffs, so anti-aliased edges stay soft. */
function keyedAlpha(data, width, height, channels) {
  const px = width * height;
  const alpha = new Uint8Array(px);
  for (let i = 0; i < px; i++) {
    const o = i * channels;
    const r = data[o];
    const g = data[o + 1];
    const b = data[o + 2];
    const dark = (BG_NONE - lum(r, g, b)) / (BG_NONE - BG_FULL);
    const chroma = Math.max(r, g, b) - Math.min(r, g, b);
    const coloured = (chroma - BG_MAX_CHROMA) / 30;
    alpha[i] = Math.round(255 * clamp01(Math.max(dark, coloured)));
  }
  return alpha;
}

/* The margin the README asks to be cropped. Anything under a hint of alpha is
   nothing, so a stray keyed pixel cannot hold the box open. */
function contentBox(alpha, width, height) {
  let top = height;
  let left = width;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (alpha[y * width + x] <= 6) continue;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
      if (x < left) left = x;
      if (x > right) right = x;
    }
  }
  if (right < 0) return { left: 0, top: 0, width, height };
  return { left, top, width: right - left + 1, height: bottom - top + 1 };
}

async function build({ name, file }) {
  const src = path.join(SRC, file);
  const isSvg = (await sharp(src).metadata()).format === "svg";
  const loaded = isSvg
    ? sharp(src, { density: 400 }).resize({ width: SVG_WIDTH })
    : sharp(src);

  const { data, info } = await loaded
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const px = width * height;

  const carried = existingAlpha(data, px, channels);
  const alpha = carried ?? keyedAlpha(data, width, height, channels);

  /* Colour thrown away, alpha kept: the mark is a silhouette in house ink. */
  const out = Buffer.allocUnsafe(px * 4);
  for (let i = 0; i < px; i++) {
    const o = i * 4;
    out[o] = INK.r;
    out[o + 1] = INK.g;
    out[o + 2] = INK.b;
    out[o + 3] = alpha[i];
  }

  const box = contentBox(alpha, width, height);
  let pipe = sharp(out, { raw: { width, height, channels: 4 } }).extract(box);
  const longest = Math.max(box.width, box.height);
  if (longest > MAX_SIDE) {
    const scale = MAX_SIDE / longest;
    pipe = pipe.resize({
      width: Math.max(1, Math.round(box.width * scale)),
      height: Math.max(1, Math.round(box.height * scale)),
      fit: "fill",
    });
  }

  const png = await pipe.png({ compressionLevel: 9, palette: false }).toBuffer();
  const final = await sharp(png).metadata();
  await writeFile(path.join(OUT, `${name}.png`), png);

  return {
    name,
    from: `${info.width}x${info.height} ${isSvg ? "svg" : "raster"}`,
    alpha: carried ? "carried" : "keyed",
    to: `${final.width}x${final.height}`,
    kb: (png.length / 1024).toFixed(1),
  };
}

await mkdir(OUT, { recursive: true });
const rows = [];
for (const source of SOURCES) rows.push(await build(source));
console.table(rows);
