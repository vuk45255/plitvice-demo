"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { FloorId } from "@/lib/floors";

/* WHICH LEVEL OF THE CLUB YOU ARE LOOKING AT.
 *
 * Two words in one hairline frame, drawn in the same brass the map controls
 * and the site's own rules are drawn in. It is a switch, not a navigation:
 * nothing is fetched, nothing reloads, no address changes — one snapshot from
 * the server already covers both levels, and this decides which half of it is
 * drawn. See lib/floor-availability.ts.
 *
 * WHY THE MARK SLIDES. The chosen level is a filled block behind the word
 * rather than a colour on it, and it travels between the two — which says
 * "the same map, moved" rather than "a different page". One layout animation
 * on one element, and it is off entirely for anyone who has asked for less
 * motion.
 *
 * ON A PHONE it is the one control that must never be hunted for: it sits at
 * the top of the map where a thumb already is, at a 38-pixel target inside a
 * 44-pixel row on each side.
 *
 * IT DRAWS NOTHING FOR A NIGHT ON ONE LEVEL. The club files a plan against
 * every Saturday — downstairs, upstairs or both — and a switch with one button
 * is furniture in the way of a map. `floors` is that night's answer; it is
 * never the building's.
 *
 * ═══ IT DOES NOT SPEAK ════════════════════════════════════════════════════
 *
 * The words are handed in rather than looked up, and that is not fussiness:
 * this component is drawn on BOTH maps, and the office's map lives under
 * app/(operations)/, which deliberately does not load the site's dictionary —
 * see the layout there. A `useLang` in here would put a translation of the
 * home page on a doorman's phone. The guest's map resolves the two words
 * through the language provider and passes them down; the office states them,
 * in the one language the office works in. */

export function FloorSelector({
  floor,
  onChange,
  floors,
  labels,
  title,
  tone = "night",
}: {
  floor: FloorId;
  onChange: (floor: FloorId) => void;
  /* The levels this night is running, in the order they are offered. */
  floors: readonly FloorId[];
  /* What each level is called, already in the reader's own language. */
  labels: Record<FloorId, string>;
  /* What the group of buttons is called, for a screen reader. */
  title: string;
  /* The guest's map is lit warm on near-black; the office's is a schematic in
     its own admin palette. Same control, two inks — exactly as the plan itself
     is drawn twice. */
  tone?: "night" | "office";
}) {
  const reduced = useReducedMotion();

  if (floors.length < 2) return null;

  const frame =
    tone === "night"
      ? "border-line bg-night/70 backdrop-blur-md"
      : "border-[var(--adm-line)]";
  const idle =
    tone === "night"
      ? "text-night-ink/55 hover:text-gold-light"
      : "text-[var(--adm-ink-3)] hover:text-[var(--adm-ink)]";
  const picked = tone === "night" ? "text-night" : "text-[var(--adm-bg)]";
  const mark = tone === "night" ? "bg-gold-light" : "bg-[var(--adm-gold)]";

  return (
    <div
      role="group"
      aria-label={title}
      className={`inline-flex shrink-0 border ${frame} p-[3px]`}
    >
      {floors.map((id) => {
        const active = id === floor;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            aria-pressed={active}
            className={`relative flex h-[38px] min-w-[4.75rem] items-center justify-center px-3 text-[0.625rem] uppercase tracking-[0.24em] transition-colors duration-500 md:min-w-[5.25rem] md:px-4 ${
              active ? picked : idle
            }`}
          >
            {active ? (
              <motion.span
                aria-hidden="true"
                layoutId={`floor-mark-${tone}`}
                transition={
                  reduced
                    ? { duration: 0 }
                    : { type: "spring", stiffness: 420, damping: 38 }
                }
                className={`absolute inset-0 ${mark}`}
              />
            ) : null}
            <span className="relative whitespace-nowrap">{labels[id]}</span>
          </button>
        );
      })}
    </div>
  );
}
