import { PlitviceLogo } from "@/components/brand/plitvice-logo";

type Size = "xs" | "sm" | "md" | "lg";

/* Heights, not font sizes: the lockup is artwork now, and its width follows
   from its own proportions (about 4 : 1). `xs` is the bar and every small
   header; at 36–40px HYPERCLUB still reads as letters rather than a rule. */
const height: Record<Size, string> = {
  xs: "h-9 md:h-10",
  sm: "h-[clamp(2.75rem,6vw,4rem)]",
  md: "h-[clamp(4rem,12vw,7.5rem)]",
  lg: "h-[clamp(5rem,17vw,12rem)]",
};

type LockupProps = {
  size?: Size;
  className?: string;
  /* "light" is for the always-night surfaces; "ink" follows the text colour
     of whatever it sits in, so it turns with the theme and with a hover. */
  tone?: "ink" | "light";
  /* Inside a link or heading that already names the club. */
  decorative?: boolean;
};

/* The house mark: the client's 2026 lockup, PL▷TWICE over HYPERCLUB, exactly
   as drawn — see components/brand/plitvice-logo.tsx. Never recoloured part by
   part, never rearranged, never set as type. */
export function Lockup({
  size = "md",
  className,
  tone = "ink",
  decorative,
}: LockupProps) {
  return (
    <PlitviceLogo
      variant="primary"
      decorative={decorative}
      className={`w-auto ${height[size]} ${tone === "light" ? "text-[#f4f1ea]" : ""} ${className ?? ""}`}
    />
  );
}
