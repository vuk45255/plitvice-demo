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

/* ═══ A NIGHT'S OWN STATE, WHICH IS NOT ITS TICKET SALE ═══════════════════
 *
 * These two books used to say the same word and mean different things. The
 * `status` column read U PRODAJI — "on sale" — for a night that was simply
 * announced, including Saturday Madness, which sells nothing online at all and
 * takes its entry at the door. So the badge that answers "is this night on"
 * answered it in the language of ticketing, about a night with no tickets.
 *
 * They are now two questions with two vocabularies, and nothing merges them:
 *
 *   EVENT — is the club running this night?  AKTIVNO · ZAVRŠENO · NACRT
 *   SALE  — is entry being sold on the site?  PRODAJA OTVORENA · BEZ ONLINE
 *           PRODAJE · RASPRODATO · …
 *
 * `on_sale` keeps its stored value — it is written on every event row and in
 * the CHECK constraint, and renaming a column's vocabulary to improve a label
 * is a migration with nothing to gain. What changed is the word on the screen.
 *
 * AND "IS IT ON TONIGHT OR ON SATURDAY" IS NOT A THIRD STATE. A published
 * night reads AKTIVNO whether its evening has come or not — the office asks
 * this badge one question and both are the same answer to it, with the date
 * beside it saying which. `eventStatusBadge` still distinguishes the two,
 * because it is a real property of the night; the vocabulary here simply does
 * not spend a word on it. */
const EVENT: Record<string, Entry> = {
  draft: { label: "Nacrt", tone: "muted" },
  on_sale: { label: "Aktivno", tone: "good" },
  sold_out: { label: "Rasprodato", tone: "gold" },
  ended: { label: "Završeno", tone: "muted" },
  /* ═══ A PUBLISHED NIGHT IS AKTIVNO, WHETHER OR NOT IT HAS STARTED ══════
   *
   * `upcoming` and `on_sale` are two lifecycle answers with one word on the
   * screen, and that is deliberate. The office asks one question of this
   * badge — is the club running this night — and "yes, on Saturday" and "yes,
   * right now" are the same answer to it. Which of the two it is is already
   * on the row beside this badge, in the date.
   *
   * The distinction is kept in `eventStatusBadge` rather than collapsed
   * there, because it is a real property of the night and a later screen may
   * want it. Nothing about the lifecycle, the stored status column or the
   * sale state changed to make this label read the way it does. */
  upcoming: { label: "Aktivno", tone: "good" },
};

/* Why a night is or is not selling entry online, from `saleState`. */
const SALE: Record<string, Entry> = {
  open: { label: "Prodaja otvorena", tone: "good" },
  /* Not a failure to open a sale — a night that sells at the door. */
  no_sale: { label: "Online prodaja isključena", tone: "muted" },
  draft: { label: "Nije objavljeno", tone: "muted" },
  ended: { label: "Prodaja zatvorena", tone: "muted" },
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
