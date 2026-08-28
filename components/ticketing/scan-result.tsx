import { scanMoment, t } from "@/lib/ticketing/copy";
import type { RedemptionResult } from "@/lib/ticketing/types";

/* WHAT THE DOORMAN SEES.
 *
 * One colour, one sentence, and the sentence is large enough to be read at
 * arm's length without being looked at properly. Somebody is standing in front
 * of them, there is a queue behind, and the light is bad — this is a traffic
 * light, not a report.
 *
 * The colours are not the club's. Everything else in this project is purple
 * and gold, and this is the one surface where that would be actively harmful:
 * green means come in and red means it does not, in every doorway in the
 * world, and a doorman glancing down must not have to interpret a champagne
 * hairline. The typography stays the house's — wide-tracked caps, the serif
 * for the night — so it still belongs to Plitvice; only the signal is
 * borrowed.
 *
 * NOTHING PERSONAL IS ON THIS SCREEN. The night, the ticket's own reference
 * and a time. A doorman's phone is held up in front of a queue and is the
 * least private screen in the building; the guest's name is not on it. */

const FACE: Record<
  RedemptionResult["outcome"],
  { bg: string; ink: string; word: string }
> = {
  valid: { bg: "bg-[#0c6b3f]", ink: "text-white", word: t.allowed },
  already_used: { bg: "bg-[#9a5b0a]", ink: "text-white", word: t.alreadyUsed },
  cancelled: { bg: "bg-[#8d1030]", ink: "text-white", word: t.cancelled },
  /* Amber rather than red, and it names the night the ticket IS for. This is
     the one refusal that is nobody's fault and has an answer: the guest is at
     the right club on the wrong evening, and the doorman can say so. */
  wrong_event: { bg: "bg-[#9a5b0a]", ink: "text-white", word: t.wrongEvent },
  invalid: { bg: "bg-[#8d1030]", ink: "text-white", word: t.invalid },
  rate_limited: { bg: "bg-[#3b2b12]", ink: "text-white", word: t.tooFast },
};

export function ScanResult({
  result,
  onDismiss,
}: {
  result: RedemptionResult;
  onDismiss: () => void;
}) {
  const face = FACE[result.outcome];

  return (
    /* The whole panel is the button. At a door, the target is the screen. */
    <button
      type="button"
      onClick={onDismiss}
      className={`flex min-h-[70dvh] w-full flex-col items-center justify-center gap-8 px-6 py-12 text-center ${face.bg} ${face.ink}`}
    >
      <p className="text-[clamp(1.5rem,8vw,2.5rem)] font-medium uppercase leading-[1.1] tracking-[0.08em]">
        {face.word}
      </p>

      {result.ticket ? (
        <div className="w-full max-w-[22rem]">
          <div className="h-px w-full bg-white/25" aria-hidden="true" />

          <p className="mt-6 font-serif text-[clamp(1.25rem,5.5vw,1.75rem)] leading-tight">
            {result.ticket.eventTitle}
          </p>

          <p className="mt-4 font-mono text-[1.0625rem] tabular-nums tracking-[0.16em]">
            {result.ticket.reference}
          </p>

          {/* On a refusal this is the time somebody already came in on this
              ticket, which is the one fact that settles an argument at the
              door. On an admission it is simply now, and is left off. */}
          {result.outcome === "already_used" && result.ticket.scannedAt ? (
            <p className="mt-6 text-[0.6875rem] uppercase tracking-[0.28em] opacity-75">
              {t.scannedBefore} · {scanMoment(result.ticket.scannedAt)}
            </p>
          ) : null}
        </div>
      ) : null}

      <span className="mt-2 text-[0.625rem] uppercase tracking-[0.36em] opacity-60">
        {t.scanAgain}
      </span>
    </button>
  );
}
