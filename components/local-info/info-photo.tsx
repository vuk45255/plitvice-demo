"use client";

import { useState } from "react";
import Image from "next/image";
import type { InfoCategory } from "@/lib/local-info";

/* The photograph for one category, and the plate it sits on.
 *
 * The plate is always underneath: the house velvet with one violet lamp behind
 * it and a little gold off the top corner, drawn rather than borrowed. It is
 * what shows if a photograph ever fails to load — the picture takes itself out
 * of the document on error rather than leaving a broken frame.
 *
 * COVER, AND THE SUBJECT PLACED BY HAND. The frame this sits in is a square on
 * the cards and a whole screen in the intro, and none of the six pictures is
 * either shape, so every one of them is cropped. `focus` is where that crop is
 * taken from — see `lib/local-info.ts` — and it is the difference between a
 * card showing the bed and a card showing the ceiling above it. */
export function InfoPhoto({
  category,
  sizes,
  className,
}: {
  category: InfoCategory;
  sizes: string;
  className?: string;
}) {
  const [missing, setMissing] = useState(false);

  return (
    <div className={`absolute inset-0 bg-night-2 ${className ?? ""}`}>
      <div
        className="absolute inset-0"
        style={{
          background: [
            /* A light source, its bounce, and the fall-off between them. The
               plate is built with the tonal range of a photograph rather than
               the flat wash it started as: greyscale plus a brightness cut is
               most of what the cards do to an image, and a flat dark panel put
               through that comes out as six identical black rectangles. This
               has somewhere to travel from and somewhere to land. */
            `radial-gradient(64% 52% at 30% 26%, ${category.tint[0]}, transparent 72%)`,
            `radial-gradient(54% 50% at 78% 82%, ${category.tint[1]}, transparent 74%)`,
            "radial-gradient(88% 74% at 42% 38%, rgba(150,132,176,0.5), transparent 76%)",
            "linear-gradient(158deg, rgba(74,52,102,0.95), rgba(18,10,28,0.98))",
          ].join(", "),
        }}
        aria-hidden="true"
      />

      {!missing && (
        <Image
          src={category.image}
          alt=""
          fill
          sizes={sizes}
          onError={() => setMissing(true)}
          style={{ objectPosition: category.focus }}
          className="img-grade object-cover"
        />
      )}
    </div>
  );
}
