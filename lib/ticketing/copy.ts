/* The words on the ticket, at the door and in the office.
 *
 * WHY THESE ARE NOT IN lib/i18n.ts. That dictionary is loaded by the language
 * provider, which is part of the site's chrome, and the pages this file serves
 * deliberately stand outside it — a doorman's scanner should not be carrying a
 * translation of the home page, and the guest opening a ticket in a queue
 * should be waiting on nothing. Ticketing is an isolated system and this is
 * its vocabulary.
 *
 * SERBIAN ONLY, FOR NOW, AND ON PURPOSE. The scanner and the admin screens are
 * used by the club's own staff and will never need another language. The
 * ticket is a different case — guests come from over the border — and the day
 * it should be bilingual, these keys move into lib/i18n.ts and the ticket page
 * reads them through the provider like every other page. Nothing else changes;
 * that is why they are keys rather than sentences written into the markup. */

export const t = {
  /* ── the ticket ─────────────────────────────────────────────────────── */
  ticket: "Ulaznica",
  ticketNumber: "Broj ulaznice",
  showAtEntrance: "Prikažite QR kod na ulazu.",
  oneEntry: "Jedan kod — jedan ulaz.",
  doors: "Početak",
  entrance: "Ulaz",
  status: "Status",
  statusValid: "Važeća",
  statusUsed: "Iskorišćena",
  statusCancelled: "Poništena",
  usedAt: "Iskorišćena",
  usedTitle: "ULAZNICA ISKORIŠĆENA",
  usedNote: "Ova ulaznica je već iskorišćena na ulazu i više ne važi.",
  cancelledNote: "Ova ulaznica je poništena. Za pomoć se javite klubu.",
  brightness: "Pojačajte osvetljenje ekrana pre skeniranja.",
  notFoundTitle: "Ulaznica nije pronađena",
  notFoundBody:
    "Ovaj link ne vodi ni do jedne ulaznice. Proverite da li ste otvorili ceo link iz poruke.",

  /* ── all the tickets in one order ───────────────────────────────────── */
  orderTitle: "Vaše ulaznice",
  orderCount: (n: number) =>
    n === 1 ? "1 ulaznica" : n < 5 ? `${n} ulaznice` : `${n} ulaznica`,
  orderNote:
    "Svaka osoba ima svoju ulaznicu i svoj QR kod. Otvorite ulaznicu na ulazu.",
  openTicket: "Otvori ulaznicu",
  orderPending:
    "Uplata još nije potvrđena. Ulaznice se pojavljuju ovde čim banka potvrdi plaćanje.",
  orderExpired:
    "Rezervacija ulaznica je istekla jer plaćanje nije završeno na vreme. Ulaznice su vraćene u prodaju.",
  orderRefunded:
    "Ova porudžbina je refundirana. Ulaznice više ne važe na ulazu.",
  orderFailed: "Plaćanje nije uspelo. Ulaznice nisu izdate.",

  /* ── the door ───────────────────────────────────────────────────────── */
  scannerTitle: "Ulaz",
  scannerReady: "Usmerite kameru na QR kod",
  scannerStarting: "Uključivanje kamere…",
  scannerBlocked: "Kamera nije dostupna",
  scannerBlockedBody:
    "Dozvolite pristup kameri u podešavanjima pregledača, ili unesite kod ručno.",
  /* The five camera failures a phone can actually have, each said plainly.
     "Uključivanje kamere…" that never changes is the bug this replaces. */
  cameraDenied: "Pristup kameri je odbijen",
  cameraDeniedBody:
    "Dozvolite kameru za ovu stranicu u podešavanjima pregledača, pa osvežite. Do tada koristite ručni unos.",
  cameraMissing: "Nema kamere",
  cameraMissingBody:
    "Ovaj uređaj nema kameru koju pregledač može da koristi. Koristite ručni unos.",
  cameraBusy: "Kamera je zauzeta",
  cameraBusyBody:
    "Druga aplikacija koristi kameru. Zatvorite je i pokušajte ponovo.",
  cameraFailed: "Kamera se ne pokreće",
  cameraFailedBody:
    "Pokušajte ponovo, ili koristite ručni unos ako se ne pokrene.",
  insecure: "Kamera zahteva HTTPS vezu.",
  insecureBody:
    "Otvorite skener preko https adrese (ili localhost). Preko obične http adrese pregledač ne dozvoljava pristup kameri. Ručni unos radi i ovako.",
  cameraRetry: "Pokušaj ponovo",

  allowed: "ULAZ DOZVOLJEN",
  alreadyUsed: "VEĆ ISKORIŠĆENA",
  invalid: "NEVAŽEĆA ULAZNICA",
  cancelled: "ULAZNICA JE PONIŠTENA",
  wrongEvent: "ULAZNICA JE ZA DRUGI DOGAĐAJ",
  tooFast: "Previše pokušaja. Sačekajte trenutak.",
  scannedBefore: "Prethodno skeniranje",
  scanAgain: "Skeniraj sledeću",
  manualEntry: "Unesi kod ručno",
  manualLabel: "Broj ulaznice",
  manualHint: "PLV-XXXXX-XXXXX",
  manualCheck: "Proveri",
  manualBack: "Nazad na kameru",
  checking: "Provera…",
  sessionLost: "Sesija je istekla. Osvežite stranicu i prijavite se ponovo.",
  networkError: "Nema veze sa serverom. Pokušajte ponovo.",
  scanningFor: "Skeniram za",
  noEventTonight:
    "Nijedan događaj nije izabran. Izaberite večerašnji događaj pre skeniranja.",
  chooseEvent: "Događaj",

  /* ── signing in ─────────────────────────────────────────────────────── */
  gateTitle: "Ulaz za osoblje",
  gateBody: "Unesite lozinku za pristup.",
  gateLabel: "Lozinka",
  gateDoor: "Ulaz",
  gateSubmit: "Uđi",
  gateWrong: "Pogrešna lozinka.",
  gateClosed: "Pristup osoblju nije podešen na ovom serveru.",
  gateOpenWarning:
    "RAZVOJNI REŽIM — pristup je otvoren jer lozinke osoblja nisu podešene.",
  signOut: "Odjavi se",

  /* ── the office ─────────────────────────────────────────────────────── */
  adminTitle: "Uprava",
  adminEvents: "Događaji",
  adminOrders: "Porudžbine",
  adminReservations: "Rezervacije",
  adminScanner: "Skener",
  capacity: "Kapacitet",
  paidTickets: "Plaćene ulaznice",
  heldNow: "Trenutno rezervisano",
  available: "Slobodno",
  entered: "Ušlo gostiju",
} as const;

/* ── the club's own way of writing a date ─────────────────────────────── */

const TZ = "Europe/Belgrade";

/* "subota, 22. avgust 2026." — the night, as the guest would say it. */
export function eventDate(iso: string): string {
  return new Intl.DateTimeFormat("sr-Latn-RS", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: TZ,
  }).format(new Date(iso));
}

/* "22.00" — the club's clock, whatever clock the reader's phone is on. */
export function eventTime(iso: string): string {
  return new Intl.DateTimeFormat("sr-Latn-RS", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
  }).format(new Date(iso));
}

/* "22.08. u 23.14" — a scan, for the doorman reading when somebody came in. */
export function scanMoment(iso: string): string {
  const date = new Intl.DateTimeFormat("sr-Latn-RS", {
    day: "2-digit",
    month: "2-digit",
    timeZone: TZ,
  }).format(new Date(iso));
  return `${date} u ${eventTime(iso)}`;
}

/* Prices are shown in the club's own currency. */
export function price(amount: number): string {
  return new Intl.NumberFormat("sr-RS", {
    style: "currency",
    currency: "RSD",
    maximumFractionDigits: 0,
  }).format(amount);
}

/* The other direction: a wall clock reading the club typed, turned into the
 * instant it actually names.
 *
 * WHY THIS IS NOT `new Date(value)`. A `datetime-local` input gives back
 * "2026-08-29T22:00" with no zone at all, and `new Date` of that reads it in
 * the SERVER's zone — which on Vercel is UTC. The club types ten o'clock,
 * meaning ten o'clock in Inđija, and the night gets stored as midnight. Every
 * ticket, every door time and every sales window would be two hours out for
 * half the year and one hour out for the other half.
 *
 * The correction is found rather than assumed: guess that the reading is UTC,
 * ask what that instant looks like on a Belgrade clock, and shift by the
 * difference. Twice, because a shift can cross a daylight-saving boundary and
 * change the answer — the second pass settles it. */
export function belgradeInstant(local: string): string | undefined {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(local)) return undefined;

  const wanted = Date.parse(`${local.slice(0, 16)}:00Z`);
  if (Number.isNaN(wanted)) return undefined;

  let guess = wanted;
  for (let pass = 0; pass < 2; pass += 1) {
    const shown = Date.parse(`${wallClock(new Date(guess))}:00Z`);
    if (shown === wanted) break;
    guess += wanted - shown;
  }
  return new Date(guess).toISOString();
}

/* "2026-08-29T22:00" — an instant as the club's own clock shows it. Used by
   the correction above and by the admin form's date fields. */
export function wallClock(date: Date): string {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
  return parts.replace(" ", "T");
}

/* "za 7 min" / "isteklo" — how long a checkout hold has left, for the admin
   list. Whole minutes: a doorman does not need seconds and a list that ticks
   is a list that never stops re-rendering. */
export function untilExpiry(iso: string, now = Date.now()): string {
  const seconds = Math.round((Date.parse(iso) - now) / 1000);
  if (seconds <= 0) return "isteklo";
  if (seconds < 60) return `${seconds} s`;
  return `${Math.ceil(seconds / 60)} min`;
}
