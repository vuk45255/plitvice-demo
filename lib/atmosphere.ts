import type { CSSProperties } from "react";

/* ONE BREATH, AS THE COMPOSITOR PLAYS IT.
 *
 * Builds the custom properties `.atmo-loop` reads — see app/globals.css for
 * why the site's infinite loops are CSS and no longer Motion. Every loop on
 * the site is the same shape, `[a, b, a]` eased in and out, so a loop is
 * described by its two ends:
 *
 *   breath({ duration: 7, delay: 1.6, opacity: [0.35, 1], scale: [0.92, 1.16] })
 *
 * is what used to be written
 *
 *   animate={{ opacity: [0.35, 1, 0.35], scale: [0.92, 1.16, 0.92] }}
 *   transition={{ duration: 7, delay: 1.6, repeat: Infinity, ease: "easeInOut" }}
 *
 * Numbers for `x` and `y` are pixels, strings keep their own unit (percentages
 * of the element's own box, as Motion read them). `rest` is the opacity shown
 * when there is no animation at all — reduced motion — which is the resting
 * pose the Motion versions snapped to. */
type Pair<T> = readonly [T, T];

const unit = (value: number | string) =>
  typeof value === "number" ? `${value}px` : value;

export function breath({
  duration,
  delay = 0,
  opacity,
  scale,
  x,
  y,
  blur,
  rest,
}: {
  duration: number;
  delay?: number;
  opacity?: Pair<number>;
  scale?: Pair<number>;
  x?: Pair<number | string>;
  y?: Pair<number | string>;
  blur?: Pair<string>;
  rest?: number;
}): CSSProperties {
  const style: Record<string, string | number> = {
    "--atmo-duration": `${duration}s`,
    "--atmo-delay": `${delay}s`,
  };
  if (opacity) {
    style["--atmo-o0"] = opacity[0];
    style["--atmo-o1"] = opacity[1];
  }
  if (scale) {
    style["--atmo-s0"] = scale[0];
    style["--atmo-s1"] = scale[1];
  }
  if (x) {
    style["--atmo-x0"] = unit(x[0]);
    style["--atmo-x1"] = unit(x[1]);
  }
  if (y) {
    style["--atmo-y0"] = unit(y[0]);
    style["--atmo-y1"] = unit(y[1]);
  }
  if (blur) {
    style["--atmo-b0"] = blur[0];
    style["--atmo-b1"] = blur[1];
  }
  if (rest !== undefined) style["--atmo-rest"] = rest;
  return style as CSSProperties;
}
