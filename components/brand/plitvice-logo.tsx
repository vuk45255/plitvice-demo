import type { SVGProps } from "react";
import { MARK, PRIMARY, SYMBOL } from "@/lib/brand-artwork";

/* THE HOUSE MARK — 2026.
 *
 * One component, three official pieces of the client's artwork, drawn inline
 * so they are crisp at any size, cost no request and take the colour of
 * whatever they sit in (`currentColor`):
 *
 *   primary  PL▷TWICE over HYPERCLUB — the lockup. Headers, hero, footer.
 *   mark     the triangle with HYPERCLUB running through it — the standalone
 *            logo, for square places.
 *   symbol   the triangle alone, exactly as it stands inside the lockup — for
 *            sizes where the HYPERCLUB inside the mark would be a smudge.
 *
 * The geometry is generated from the client's PDFs (lib/brand-artwork.ts);
 * the same shapes are published as files in public/brand/2026/. Size it with a
 * height OR a width class and the other follows: the intrinsic width/height
 * attributes carry the aspect ratio, so nothing stretches and nothing shifts. */

const ART = { primary: PRIMARY, mark: MARK, symbol: SYMBOL } as const;

export type LogoVariant = keyof typeof ART;

/* What a screen reader hears. The lockup reads the way the club is named. */
export const LOGO_NAME = "Plitvice Hyperclub";

type PlitviceLogoProps = Omit<SVGProps<SVGSVGElement>, "children"> & {
  variant?: LogoVariant;
  /* Set when the logo sits inside something that already names the club
     (a link with its own label, a heading) so it is not read twice. */
  decorative?: boolean;
  title?: string;
};

export function PlitviceLogo({
  variant = "primary",
  decorative = false,
  title = LOGO_NAME,
  className,
  ...rest
}: PlitviceLogoProps) {
  const art = ART[variant];
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${art.width} ${art.height}`}
      width={art.width}
      height={art.height}
      fill="currentColor"
      className={`block shrink-0 ${className ?? ""}`}
      {...(decorative
        ? { "aria-hidden": true, focusable: false }
        : { role: "img", "aria-label": title })}
      {...rest}
    >
      <path d={art.d} />
    </svg>
  );
}
