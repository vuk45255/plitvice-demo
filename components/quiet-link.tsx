"use client";

import Link from "next/link";
import { Arrow } from "@/components/arrow";

/* A door that refuses to look like a button.

   Small caps, wide tracking and the house gold — the same voice as every rail
   on the site, with the house arrow after it. On hover the rule grows, the
   word steps a few pixels toward it, and the gold warms as though a lamp had
   been turned a little further round. Nothing scales, nothing lifts.

   The trailing letter-spacing of the last glyph is paid back by an equal
   indent, so the gap between the word and its arrow is the one that was set. */
export function QuietLink({
  href,
  label,
  className,
}: {
  href: string;
  label: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`group inline-flex items-center gap-4 text-[0.625rem] uppercase tracking-[0.42em] text-gold/70 transition-colors duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] hover:text-gold-light focus-visible:text-gold-light sm:text-[0.6875rem] ${className ?? ""}`}
    >
      <span className="inline-block indent-[0.42em] transition-[transform,text-shadow] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-[3px] group-hover:[text-shadow:0_0_22px_rgba(200,164,93,0.45)] group-focus-visible:translate-x-[3px] group-focus-visible:[text-shadow:0_0_22px_rgba(200,164,93,0.45)]">
        {label}
      </span>
      <Arrow className="w-7 group-hover:w-12 group-focus-visible:w-12" />
    </Link>
  );
}
