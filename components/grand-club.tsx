import { site } from "@/lib/site";

/* The house signature.
 *
 * "Grand Club" is not set, it is signed — a script hand between two hairlines
 * that reach in toward it. The treatment began life on the phone, in the
 * hero's opening mark, and this is that same signature made available to the
 * rest of the site so there is only ever one of it.
 *
 * The hero still draws its own, because there the script and each of its
 * rules are animated separately and have to be reachable one at a time. It
 * reads its typography from the tokens below rather than restating it, so the
 * two can never drift apart.
 *
 * The other two lines of the mark — PLITVICE and INĐIJA — are untouched by
 * any of this. They are set; only the tagline is written. */

export type SignatureSize = "xs" | "sm" | "md" | "lg";

/* The hand itself. Great Vibes needs a little tracking to stop its joins
   crowding, and nothing like the wide tracking a small-caps rail wants — the
   air around this line comes from the rules, never from the letters.
   `normal-case` because the mark this sits inside sets everything else in
   caps, and a signature is never written in caps. */
export const SIGNATURE_FACE = "font-script normal-case tracking-[0.02em]";

export const SIGNATURE_SIZE: Record<SignatureSize, string> = {
  xs: "text-[0.8125rem]",
  sm: "text-[1.125rem]",
  md: "text-[clamp(1.25rem,2.6vw,1.75rem)]",
  lg: "text-[clamp(1.5rem,3.4vw,2.5rem)]",
};

/* Great Vibes carries about 1.5em of ink between its ascent and descent, so a
   normal line box leaves the swash of the G and the tail of the b standing
   outside it. Anything that clips this line — a reveal mask, an overflow —
   has to open the box up first, and this is the amount to open it by. */
export const SIGNATURE_BOX = "leading-[1.45]";
export const SIGNATURE_INK = "pt-[0.5em] pb-[0.3em]";

const RULE: Record<SignatureSize, string> = {
  xs: "w-6",
  sm: "w-10",
  md: "w-[9vw] max-w-16",
  lg: "w-[11vw] max-w-24",
};

const GAP: Record<SignatureSize, string> = {
  xs: "gap-2",
  sm: "gap-3",
  md: "gap-3.5",
  lg: "gap-4",
};

type GrandClubSignatureProps = {
  size?: SignatureSize;
  /* "light" is for the always-night surfaces; "ink" follows the theme. */
  tone?: "ink" | "light";
  /* A rule on each side, one trailing rule, or none at all. */
  rules?: "both" | "right" | "none";
  className?: string;
};

export function GrandClubSignature({
  size = "md",
  tone = "ink",
  rules = "both",
  className,
}: GrandClubSignatureProps) {
  const ink = tone === "light" ? "text-gold-light/85" : "text-accent";
  const rule = tone === "light" ? "from-gold/60" : "from-accent/45";

  return (
    <span
      className={`inline-flex items-center justify-center ${GAP[size]} ${className ?? ""}`}
    >
      {rules === "both" && (
        <span
          className={`h-px shrink-0 bg-gradient-to-l to-transparent ${RULE[size]} ${rule}`}
          aria-hidden="true"
        />
      )}
      <span
        className={`${SIGNATURE_FACE} ${SIGNATURE_SIZE[size]} ${SIGNATURE_BOX} ${ink}`}
      >
        {site.tagline}
      </span>
      {rules !== "none" && (
        <span
          className={`h-px shrink-0 bg-gradient-to-r to-transparent ${RULE[size]} ${rule}`}
          aria-hidden="true"
        />
      )}
    </span>
  );
}
