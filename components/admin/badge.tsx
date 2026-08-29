/* ONE WORD, ONE COLOUR, EVERYWHERE IN THE OFFICE.
 *
 * A payment, a table, a ticket, a night and a scan all have a state, and until
 * now each screen printed the database's own value: `paid`, `seat-held`,
 * `on_sale`. That is the wrong audience. The people reading these screens are
 * running a club in Inđija at one in the morning, so the word is Serbian and
 * the colour means what it means at a door:
 *
 *   green  — done, in, paid, confirmed
 *   amber  — waiting, temporary, somebody else is mid-way through
 *   red    — wrong, refused, failed
 *   violet — reserved: the club's own colour, for a table that is spoken for
 *   gold   — the thing you are looking at right now
 *   muted  — over, spent, no longer interesting
 *
 * WHY A TABLE AND NOT A `switch` IN EACH PAGE. Because the same `pending`
 * means "na čekanju" on the reservations screen and "u toku" on the orders
 * screen, and the only way those two stay right is if the mapping is written
 * down once, per domain, in one file.
 *
 * ENGLISH SURVIVES IN EXACTLY ONE PLACE: the technical value itself, which is
 * never rendered. Nothing on a staff screen mixes the two languages. */

type Tone = "good" | "warn" | "bad" | "violet" | "gold" | "muted";

type Entry = { label: string; tone: Tone };

/* An order's money. */
const PAYMENT: Record<string, Entry> = {
  paid: { label: "Plaćeno", tone: "good" },
  pending: { label: "U toku", tone: "warn" },
  expired: { label: "Isteklo", tone: "muted" },
  failed: { label: "Neuspelo", tone: "bad" },
  refunded: { label: "Refundirano", tone: "bad" },
};

/* A table. */
const RESERVATION: Record<string, Entry> = {
  pending: { label: "Na čekanju", tone: "warn" },
  confirmed: { label: "Potvrđeno", tone: "good" },
  rejected: { label: "Odbijeno", tone: "bad" },
  cancelled: { label: "Otkazano", tone: "muted" },
  expired: { label: "Isteklo", tone: "muted" },
};

/* A place on the floor. */
const SEAT: Record<string, Entry> = {
  available: { label: "Slobodno", tone: "good" },
  held: { label: "Zadržano", tone: "warn" },
  reserved: { label: "Rezervisano", tone: "violet" },
};

/* An admission. */
const TICKET: Record<string, Entry> = {
  valid: { label: "Važeća", tone: "good" },
  used: { label: "Ušlo", tone: "muted" },
  cancelled: { label: "Poništena", tone: "bad" },
};

/* A night. */
const EVENT: Record<string, Entry> = {
  draft: { label: "Nacrt", tone: "muted" },
  on_sale: { label: "U prodaji", tone: "good" },
  sold_out: { label: "Rasprodato", tone: "gold" },
  ended: { label: "Završeno", tone: "muted" },
};

/* Why a night is not selling, from `saleState`. */
const SALE: Record<string, Entry> = {
  open: { label: "Prodaja otvorena", tone: "good" },
  /* Not a failure to open a sale — a night that sells at the door. */
  no_sale: { label: "Bez online prodaje", tone: "muted" },
  draft: { label: "Nije objavljeno", tone: "muted" },
  ended: { label: "Završeno", tone: "muted" },
  sold_out: { label: "Rasprodato", tone: "gold" },
  too_early: { label: "Prodaja još nije počela", tone: "warn" },
  too_late: { label: "Prodaja zatvorena", tone: "muted" },
  no_price: { label: "Cena nije podešena", tone: "warn" },
};

/* What the door said. */
const SCAN: Record<string, Entry> = {
  redeemed: { label: "Ulaz", tone: "good" },
  already_used: { label: "Već iskorišćena", tone: "warn" },
  wrong_event: { label: "Drugo veče", tone: "warn" },
  cancelled: { label: "Poništena", tone: "bad" },
  invalid: { label: "Nevažeća", tone: "bad" },
  unknown: { label: "Nepoznata", tone: "bad" },
  rate_limited: { label: "Previše pokušaja", tone: "muted" },
};

/* Whether a message went out. */
const DELIVERY: Record<string, Entry> = {
  sent: { label: "Poslato", tone: "good" },
  queued: { label: "U redu", tone: "warn" },
  failed: { label: "Nije poslato", tone: "bad" },
  "reservation-guest": { label: "Potvrda gostu", tone: "muted" },
  "reservation-office": { label: "Obaveštenje", tone: "muted" },
};

const BOOKS: Record<string, Record<string, Entry>> = {
  payment: PAYMENT,
  reservation: RESERVATION,
  seat: SEAT,
  ticket: TICKET,
  event: EVENT,
  sale: SALE,
  scan: SCAN,
  delivery: DELIVERY,
};

export type BadgeKind = keyof typeof BOOKS;

export function Badge({
  kind,
  value,
  className = "",
}: {
  kind: BadgeKind;
  value: string;
  className?: string;
}) {
  /* An unknown value is shown as it is rather than swallowed: a state nobody
     has a word for yet is something staff should be able to report, not
     something that silently disappears from a row. */
  const entry = BOOKS[kind][value] ?? { label: value, tone: "muted" as Tone };

  return (
    <span className={`adm-badge adm-badge--${entry.tone} ${className}`}>
      {entry.label}
    </span>
  );
}

/* The same words without the box, for a line of running text. */
export function stateLabel(kind: BadgeKind, value: string): string {
  return BOOKS[kind][value]?.label ?? value;
}
