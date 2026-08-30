import { Lockup } from "@/components/lockup";
import { eventDate, eventTime, t } from "@/lib/ticketing/copy";
import type { TicketStatus } from "@/lib/ticketing/types";

/* THE TICKET.
 *
 * A guest holds this up in a doorway. That single sentence decides every
 * choice on the page:
 *
 *   · The QR is the largest thing on it, on white, dead centre, with nothing
 *     over it. No grain, no glow, no wordmark in the middle of it. Everything
 *     else on this page carries the house's hand — this one rectangle is a
 *     machine-readable object and is left alone. See lib/ticketing/qr.ts.
 *   · It arrives as HTML with the code already drawn in. Nothing here waits on
 *     JavaScript, a provider or a network round trip, because the queue does
 *     not wait either.
 *   · The reference is set large enough to be read out across a doorway, and
 *     spaced so that a five-character group can be found again after looking
 *     up.
 *   · What it does NOT show: the guest's name, their email, their telephone
 *     number, what they paid, the order this came from. A ticket is held up in
 *     front of strangers, and it gets photographed and posted. None of that is
 *     anybody's business but the club's, and none of it has to be on here for
 *     the thing to work.
 *
 * The shape is the club's: sharp corners, gold hairlines, the mark at the top,
 * enormous serif for the night and wide-tracked small caps for the facts. And
 * one borrowing from a paper ticket — a perforation across the middle, drawn
 * as a dashed rule between two notches bitten out of the edges. It is the only
 * ornament on the page, and it is what makes this read as a ticket rather than
 * as a card in a dashboard. */

export type TicketFaceProps = {
  eventTitle: string;
  eventStartsAt: string;
  reference: string;
  status: TicketStatus;
  scannedAt?: string;
  /* The code, already rendered to SVG on the server. */
  qr: string;
  /* When the ticket is one of several bought together — "2 / 4". Never the
     order it belongs to. */
  position?: { index: number; of: number };
};

export function TicketFace({
  eventTitle,
  eventStartsAt,
  reference,
  status,
  scannedAt,
  qr,
  position,
}: TicketFaceProps) {
  const spent = status !== "valid";

  return (
    <article className="relative mx-auto w-full max-w-[25rem] border border-line bg-night-2/40">
      {/* ── the stub ────────────────────────────────────────────────── */}
      <header className="px-6 pb-8 pt-9 text-center">
        <Lockup size="xs" tone="light" />

        <h1 className="mt-8 font-serif text-[clamp(1.75rem,7.5vw,2.25rem)] leading-[1.05] text-night-ink">
          {eventTitle}
        </h1>

        <p className="rail rail-night rail-center mt-4 text-[0.5625rem]">
          {eventDate(eventStartsAt)}
        </p>

        <dl className="mt-7 flex items-baseline justify-center gap-8">
          <Fact label={t.doors} value={eventTime(eventStartsAt)} />
          {position ? (
            <Fact
              label={t.ticket}
              value={`${position.index} / ${position.of}`}
            />
          ) : null}
        </dl>
      </header>

      <Perforation />

      {/* ── the code ────────────────────────────────────────────────── */}
      <div className="px-6 pb-9 pt-8">
        <div
          className={`mx-auto w-full max-w-[17.5rem] bg-white p-3 transition-opacity ${
            /* A spent ticket keeps its code — the door still needs to be able
               to read it and say why it is refusing — but it stops looking
               like something to hold up. */
            spent ? "opacity-35" : ""
          }`}
        >
          {/* The SVG is generated on the server and inserted as markup. It is
              built by lib/ticketing/qr.ts out of one URL and contains no other
              input, so there is nothing here for anybody to inject. */}
          <div
            className="[&>svg]:block [&>svg]:h-auto [&>svg]:w-full"
            dangerouslySetInnerHTML={{ __html: qr }}
          />
        </div>

        <p className="mt-7 text-center text-[0.5rem] uppercase tracking-[0.42em] text-night-ink/40">
          {t.ticketNumber}
        </p>
        <p className="mt-2 text-center font-mono text-[1.0625rem] tabular-nums tracking-[0.14em] text-gold-light">
          {reference}
        </p>

        <div className="mt-8">
          <StatusLine status={status} scannedAt={scannedAt} />
        </div>

        {status === "valid" ? (
          <p className="mt-8 text-center text-[0.8125rem] leading-relaxed text-night-ink/70">
            {t.showAtEntrance}
            <span className="mt-1 block text-night-ink/40">{t.oneEntry}</span>
          </p>
        ) : null}
      </div>
    </article>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <dt className="text-[0.5rem] uppercase tracking-[0.36em] text-night-ink/40">
        {label}
      </dt>
      <dd className="mt-2 text-[0.875rem] tabular-nums tracking-[0.08em] text-night-ink/85">
        {value}
      </dd>
    </div>
  );
}

/* The tear. Two notches bitten out of the edges — filled with the page's own
   ground so the card reads as cut rather than as drawn on — and a dashed
   hairline between them. */
function Perforation() {
  return (
    <div className="relative h-0" aria-hidden="true">
      <span className="absolute -left-px top-1/2 block h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-line bg-night" />
      <span className="absolute -right-px top-1/2 block h-4 w-4 translate-x-1/2 -translate-y-1/2 rounded-full border border-line bg-night" />
      <span className="absolute inset-x-5 top-1/2 block h-px -translate-y-1/2 [background-image:repeating-linear-gradient(to_right,var(--rail)_0_4px,transparent_4px_10px)] opacity-45" />
    </div>
  );
}

function StatusLine({
  status,
  scannedAt,
}: {
  status: TicketStatus;
  scannedAt?: string;
}) {
  if (status === "valid") {
    return (
      <p className="rail rail-night rail-center text-center text-[0.5625rem]">
        {t.statusValid}
      </p>
    );
  }

  /* Said the way the door says it, in full, rather than as a one-word status
     chip — a guest who has already been let in on this code needs to read the
     sentence, not decode a label. */
  const word = status === "used" ? t.usedTitle : t.statusCancelled;
  const note = status === "used" ? t.usedNote : t.cancelledNote;

  return (
    <div className="border border-[#e6a091]/35 bg-[#e6a091]/[0.06] px-5 py-4 text-center">
      <p className="text-[0.5625rem] uppercase tracking-[0.42em] text-[#e6a091]">
        {word}
      </p>
      <p className="mt-3 text-[0.8125rem] leading-relaxed text-night-ink/65">
        {note}
      </p>
      {status === "used" && scannedAt ? (
        <p className="mt-2 text-[0.75rem] tabular-nums text-night-ink/40">
          {new Date(scannedAt).toLocaleString("sr-Latn-RS", {
            timeZone: "Europe/Belgrade",
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      ) : null}
    </div>
  );
}
