/* The billing, run along the bottom edge of the artwork.
 *
 * Two identical runs of the name sit side by side inside a track that slides
 * exactly half its own width, so the frame it ends on is the frame it began on
 * and the loop cannot be seen. The number of repetitions is chosen so a single
 * run always outruns the poster — a short name simply repeats more often — and
 * the duration follows the length of that run, which is what keeps a two-word
 * name and a five-word one moving at the same speed.
 *
 * It sits inside the poster's own rounded, clipped frame, so the strip takes
 * the curve of the bottom corners with it. Nothing here is read aloud: the
 * name is already on the page in the billing beside it. */

export function PosterTicker({ text }: { text: string }) {
  const unit = text.length + 3;
  const reps = Math.max(3, Math.ceil(72 / unit));
  /* Roughly 45px a second at this size and tracking. */
  const duration = Math.round(reps * unit * 0.26);

  const run = (
    <span className="flex shrink-0 items-center">
      {Array.from({ length: reps }, (_, i) => (
        <span key={i} className="flex items-center whitespace-nowrap">
          {text}
          <span className="mx-[1.5em] text-gold/55">·</span>
        </span>
      ))}
    </span>
  );

  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-0 overflow-hidden border-t border-gold/15 py-3 backdrop-blur-[2px]"
      style={{ background: "rgba(8, 5, 12, 0.78)" }}
      aria-hidden="true"
    >
      <div
        className="marquee-track text-[0.6875rem] uppercase leading-none tracking-[0.3em] text-night-ink/85"
        style={{ "--marquee-duration": `${duration}s` } as React.CSSProperties}
      >
        {run}
        {run}
      </div>
    </div>
  );
}
