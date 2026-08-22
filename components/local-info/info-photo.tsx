"use client";

import { useState } from "react";
import Image from "next/image";
import type { InfoCategory } from "@/lib/local-info";

/* The photograph for one category, and the plate it sits on.
 *
 * None of the six pictures are in the repository yet, so the plate is what a
 * visitor sees today: the house velvet with one violet lamp behind it and a
 * little gold off the top corner. It is drawn rather than borrowed — putting
 * the club's own dance floor behind the word RESTORANI would be worse than an
 * honest empty frame.
 *
 * The plate is always underneath. The photograph lays over it and takes itself
 * out of the document again if the file is not there, which means dropping the
 * six files into /public/info is the whole of the work — nothing here has to
 * be edited for them to appear.
 *
 * The plate is deliberately built out of colour rather than grey: the cards
 * grade everything above them to grayscale at rest and let it back in on
 * hover, and a plate with no colour in it would make that look broken. */
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
          className="img-grade object-cover"
        />
      )}
    </div>
  );
}
