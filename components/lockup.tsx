import { site } from "@/lib/site";

type Size = "xs" | "sm" | "md" | "lg";

const word: Record<Size, string> = {
  xs: "text-base",
  sm: "text-[clamp(1.75rem,4vw,2.75rem)]",
  md: "text-[clamp(2.75rem,8vw,6rem)]",
  lg: "text-[clamp(3rem,12vw,11rem)]",
};

const rail: Record<Size, string> = {
  xs: "text-[0.4375rem] tracking-[0.34em]",
  sm: "text-[0.5625rem] tracking-[0.42em]",
  md: "text-[0.625rem] tracking-[0.5em]",
  lg: "text-[0.6875rem] tracking-[0.58em]",
};

const gap: Record<Size, string> = {
  xs: "space-y-[0.15em]",
  sm: "space-y-3",
  md: "space-y-5",
  lg: "space-y-6",
};

type LockupProps = {
  size?: Size;
  className?: string;
  /* Muted rails sit at this opacity against the current ink colour. */
  tone?: "ink" | "light";
};

/* The house mark, exactly as it reads on the door:
   GRAND CLUB / PLITVICE / INĐIJA. Never reorder, never drop a rail. */
export function Lockup({ size = "md", className, tone = "ink" }: LockupProps) {
  const railTone =
    tone === "light" ? "text-[#f4f1ea]/55" : "text-ink-muted";

  return (
    <div
      className={`flex flex-col items-center text-center uppercase ${gap[size]} ${className ?? ""}`}
    >
      <span className={`${rail[size]} ${railTone} indent-[0.5em]`}>
        {site.tagline}
      </span>
      <span
        className={`font-serif leading-[0.92] tracking-[0.02em] ${word[size]}`}
      >
        {site.name}
      </span>
      <span className={`${rail[size]} ${railTone} indent-[0.5em]`}>
        {site.town}
      </span>
    </div>
  );
}
