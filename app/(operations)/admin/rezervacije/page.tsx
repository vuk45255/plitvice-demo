import Link from "next/link";
import type { Metadata } from "next";
import { Empty, PageHeader, Panel, Scroller } from "@/components/admin/shell";
import { Badge } from "@/components/admin/badge";
import { PhoneReservationForm } from "@/components/admin/phone-reservation-form";
import { ReservationActions } from "@/components/admin/reservation-actions";
import { upcomingEvents } from "@/lib/events";
import {
  floorState,
  reservationCounts,
  reservationsForEvent,
  searchReservations,
  type ReservationLine,
} from "@/lib/reservations/admin";
import { scanMoment } from "@/lib/ticketing/copy";
import { requireStaff } from "@/lib/staff/guard";

/* THE FLOOR, FROM THE OFFICE.
 *
 * ONE LIST FOR BOTH DOORS. A booking made on the site and one taken over the
 * telephone are the same row in the same table, told apart only by a small
 * grey word — because the moment they are two lists, staff are reading one of
 * them and promising a separe that is already gone in the other.
 *
 * ON A PHONE IT IS CARDS AND ON A LAPTOP IT IS A TABLE. The same rows, laid
 * out twice: an eight-column table on a 390px screen is a table nobody reads,
 * and a list of cards on a laptop wastes the one advantage a big screen has.
 * The card leads with the guest and their number, because the reason staff
 * open this screen is almost always to ring somebody back.
 *
 * Nights come from lib/events.ts rather than from the ticketing `events`
 * table: tables belong to the poster wall's idea of a night, which is what the
 * floor plan and the reservation room are both keyed on. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Rezervacije",
  robots: { index: false, follow: false, nocache: true },
};

export default async function AdminReservationsPage({
  searchParams,
}: PageProps<"/admin/rezervacije">) {
  await requireStaff("admin");

  const params = await searchParams;
  const term = typeof params.q === "string" ? params.q.trim() : "";
  const seat = typeof params.seat === "string" ? params.seat : undefined;

  /* Only nights that actually take tables. A select full of nights that cannot
     be booked is a select somebody will pick from. */
  const nights = upcomingEvents.filter((event) => event.tables.enabled);
  const chosen =
    (typeof params.event === "string" &&
      nights.find((event) => event.slug === params.event)) ||
    nights[0];

  const [rows, counts, floor] = await Promise.all([
    term ? searchReservations(term) : chosen ? reservationsForEvent(chosen.slug) : [],
    chosen ? reservationCounts(chosen.slug) : null,
    chosen ? floorState(chosen.slug) : null,
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Sala"
        title="Rezervacije"
        lede={
          chosen
            ? "Sajt i telefon pišu u istu knjigu — sto obećan telefonom nestaje sa plana istog trenutka."
            : undefined
        }
        action={
          chosen ? (
            <>
              <Link
                href={`/admin/plan?event=${encodeURIComponent(chosen.slug)}`}
                className="adm-btn adm-btn--sm"
              >
                Plan stolova
              </Link>
              <Link href="#nova" className="adm-btn adm-btn--sm adm-btn--primary">
                Nova rezervacija
              </Link>
            </>
          ) : null
        }
      />

      {/* ── the search bar ────────────────────────────────────────────── */}
      <form
        method="get"
        className="mb-6 flex flex-wrap items-end gap-3 sm:gap-4"
      >
        <label className="min-w-0 flex-1 basis-[16rem]">
          <span className="adm-label">Pretraga</span>
          <input
            name="q"
            defaultValue={term}
            autoComplete="off"
            placeholder="Ime, telefon, email ili sto"
            className="adm-field adm-search mt-2"
          />
        </label>

        <label className="basis-[13rem]">
          <span className="adm-label">Veče</span>
          <select
            name="event"
            defaultValue={chosen?.slug ?? ""}
            className="adm-field adm-search mt-2"
          >
            {nights.map((event) => (
              <option key={event.slug} value={event.slug}>
                {event.artist}
              </option>
            ))}
          </select>
        </label>

        <button type="submit" className="adm-btn h-12">
          Prikaži
        </button>
        {term ? (
          <Link href="/admin/rezervacije" className="adm-btn adm-btn--ghost h-12">
            Poništi
          </Link>
        ) : null}
      </form>

      {!chosen ? (
        <Panel>
          <Empty>Nijedno veče trenutno ne prima rezervacije stolova.</Empty>
        </Panel>
      ) : (
        <>
          <Panel
            title={term ? `Rezultati za „${term}”` : `Rezervacije — ${chosen.artist}`}
            action={
              counts ? (
                <span className="flex flex-wrap items-center gap-2">
                  <Badge kind="reservation" value="confirmed" />
                  <span className="adm-figure text-[0.75rem] text-[var(--adm-ink-2)]">
                    {counts.confirmed}
                  </span>
                  <Badge kind="reservation" value="pending" />
                  <span className="adm-figure text-[0.75rem] text-[var(--adm-ink-2)]">
                    {counts.pending}
                  </span>
                </span>
              ) : null
            }
          >
            {rows.length === 0 ? (
              <Empty>
                {term
                  ? "Nema pronađenih rezervacija."
                  : "Nema rezervacija za ovaj događaj."}
              </Empty>
            ) : (
              <>
                <ul className="lg:hidden">
                  {rows.map((row) => (
                    <Card key={row.id} row={row} night={chosen.artist} />
                  ))}
                </ul>

                <Scroller>
                  <table className="adm-table hidden min-w-[56rem] lg:table">
                    <thead>
                      <tr>
                        <th>Gost</th>
                        <th>Sto</th>
                        <th className="text-right">Osoba</th>
                        <th>Telefon</th>
                        <th>Status</th>
                        <th>Primljeno</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.id}>
                          <td>
                            <p className="text-[0.875rem] text-[var(--adm-ink)]">
                              {row.name}
                            </p>
                            {row.email ? (
                              <p className="mt-0.5 break-all text-[0.6875rem] text-[var(--adm-ink-4)]">
                                {row.email}
                              </p>
                            ) : null}
                            {row.note ? (
                              <p className="mt-1 max-w-[22ch] text-[0.6875rem] leading-relaxed text-[var(--adm-ink-3)]">
                                {row.note}
                              </p>
                            ) : null}
                          </td>
                          <td className="font-mono text-[0.875rem] text-[var(--adm-ink)]">
                            {row.number}
                          </td>
                          <td className="adm-figure text-right text-[0.875rem]">
                            {row.guests}
                          </td>
                          <td>
                            <a
                              href={`tel:${row.phone.replace(/\s+/g, "")}`}
                              className="adm-figure text-[0.875rem] text-[var(--adm-ink-2)] transition-colors hover:text-[var(--adm-gold)]"
                            >
                              {row.phone}
                            </a>
                          </td>
                          <td>
                            <Badge kind="reservation" value={row.status} />
                            <Provenance row={row} />
                          </td>
                          <td className="adm-figure text-[0.75rem] text-[var(--adm-ink-3)]">
                            {scanMoment(row.createdAt)}
                          </td>
                          <td>
                            <ReservationActions
                              id={row.id}
                              status={row.status}
                              hasEmail={Boolean(row.email)}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Scroller>
              </>
            )}
          </Panel>

          <div id="nova" className="scroll-mt-6">
            <Panel title={`Nova rezervacija — telefonom · ${chosen.artist}`}>
              <PhoneReservationForm
                eventId={chosen.slug}
                seats={floor?.seats ?? []}
                serverNow={floor?.serverNow ?? new Date().toISOString()}
                preselected={seat}
              />
            </Panel>
          </div>
        </>
      )}
    </>
  );
}

/* One booking on a phone. Everything staff read out on the telephone is above
   the fold: the guest, their number, the table, how many are coming. The
   number is a `tel:` link — this screen is opened on the device that is about
   to ring it. */
function Card({ row, night }: { row: ReservationLine; night: string }) {
  return (
    <li className="adm-row">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="text-[1rem] leading-snug text-[var(--adm-ink)]">{row.name}</p>
          <a
            href={`tel:${row.phone.replace(/\s+/g, "")}`}
            className="adm-figure mt-1 block text-[0.9375rem] text-[var(--adm-gold)]"
          >
            {row.phone}
          </a>
        </div>
        <Badge kind="reservation" value={row.status} />
      </div>

      <p className="mt-3 text-[0.8125rem] text-[var(--adm-ink-2)]">
        <span className="font-mono text-[var(--adm-ink)]">Sto {row.number}</span>
        <span className="text-[var(--adm-ink-4)]"> · </span>
        {row.guests} osoba
        <span className="text-[var(--adm-ink-4)]"> · </span>
        {night}
      </p>

      {row.note ? (
        <p className="mt-2 text-[0.75rem] leading-relaxed text-[var(--adm-ink-3)]">
          {row.note}
        </p>
      ) : null}

      <div className="mt-1">
        <Provenance row={row} withTime={row.createdAt} />
      </div>

      <div className="mt-3">
        <ReservationActions
          id={row.id}
          status={row.status}
          hasEmail={Boolean(row.email)}
        />
      </div>
    </li>
  );
}

/* Where the booking came from and who last touched it — the audit trail, in
   one grey line. */
function Provenance({
  row,
  withTime,
}: {
  row: ReservationLine;
  withTime?: string;
}) {
  return (
    <span className="mt-1 block text-[0.5625rem] uppercase tracking-[0.18em] text-[var(--adm-ink-4)]">
      {row.source === "phone" ? "Telefon" : "Sajt"}
      {row.createdBy ? ` · upisao ${row.createdBy}` : ""}
      {row.updatedBy ? ` · izmenio ${row.updatedBy}` : ""}
      {withTime ? ` · ${scanMoment(withTime)}` : ""}
    </span>
  );
}
