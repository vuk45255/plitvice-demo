import { Reveal } from "@/components/reveal";

type SectionHeadProps = {
  /* Small rail above. Usually omitted — the section's huge backdrop word
     names the section now, so a second label would only repeat it. */
  label?: string;
  title: React.ReactNode;
  /* Small rail below — echoes the INĐIJA line of the house mark. */
  caption?: string;
  titleId: string;
  align?: "left" | "center" | "right";
};

/* Every heading repeats the mark's hierarchy: small rail / large serif /
   small rail. No numbers, no index — this is a club, not a portfolio. */
export function SectionHead({
  label,
  title,
  caption,
  titleId,
  align = "left",
}: SectionHeadProps) {
  const textAlign =
    align === "center" ? "text-center" : align === "right" ? "text-right" : "";
  const captionAlign =
    align === "center" ? "mx-auto" : align === "right" ? "ml-auto" : "";

  return (
    <div className={textAlign}>
      {label && (
        <Reveal>
          <span
            className={`rail block ${align === "center" ? "rail-center" : ""}`}
          >
            {label}
          </span>
        </Reveal>
      )}
      <Reveal delay={0.08}>
        <h2
          id={titleId}
          className={`font-serif text-[clamp(2.25rem,5.5vw,4.75rem)] leading-[1.02] tracking-tight ${
            label ? "mt-6" : ""
          }`}
        >
          {title}
        </h2>
      </Reveal>
      {caption && (
        <Reveal delay={0.16}>
          <div
            className={`mt-8 flex w-fit items-center gap-5 ${captionAlign} ${
              align === "right" ? "flex-row-reverse" : ""
            }`}
          >
            {align === "center" && (
              <span className="h-px w-12 bg-line" aria-hidden="true" />
            )}
            <span className={`rail ${align === "center" ? "rail-center" : ""}`}>
              {caption}
            </span>
            <span className="h-px w-12 bg-line" aria-hidden="true" />
          </div>
        </Reveal>
      )}
    </div>
  );
}
