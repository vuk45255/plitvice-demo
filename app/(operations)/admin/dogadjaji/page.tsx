import Link from "next/link";
import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { Empty, PageHeader, Panel } from "@/components/admin/shell";
import { EventCard } from "@/components/admin/event-card";
import { LegacyRow } from "@/components/admin/legacy-row";
import { allTicketingEvents } from "@/lib/ticketing/events";
import { reportSummaries } from "@/lib/club/event-report";
import {
  GROUP_LABELS,
  groupEvents,
  isOperational,
  toCard,
  type EventGroup,
} from "@/lib/club/event-manager";
import { requireStaff } from "@/lib/staff/guard";

/* /admin/dogadjaji — THE PROGRAMME THIS SYSTEM RUNS.
 *
 * ═══ THE OPERATIONAL PROGRAMME, AND THE POSTER WALL UNDER IT ══════════════
 *
 * The list used to hold everything the `events` table had in it, which meant
 * ten poster nights from before the software sat under ZAVRŠENI carrying
 * `0 / 500 prodato` each. Every one of those zeros was true and every one of
 * them was a lie: nothing was sold because nothing COULD be sold — the club
 * ran those nights years before there was a checkout to sell through.
 *
 * So the working list is the nights this system ran, and the poster archive is
 * a shut drawer at the bottom with no figures in it at all. Nothing is deleted,
 * nothing is hidden, and one tap opens it. See `isOperational` in
 * lib/club/event-manager.ts.
 *
 * ═══ AND THE FIGURES ARE ONE SET OF QUERIES, NOT ONE PER NIGHT ════════════
 *
 * `reportSummaries` answers for the whole programme in three aggregates. The
 * previous version ran `countsFor` inside a `map`, which is a query per night
 * and gets slower every month the club stays in business.
 *
 * ═══ THREE GROUPS AND A DRAWER ════════════════════════════════════════════
 *
 * AKTIVNI first, because it is what the club is working on tonight. DRAFT
 * second, because those are the ones somebody started and did not finish and
 * they should nag. ZAVRŠENI third — and that is where the reports live, so it
 * is not a graveyard. ARHIVA and the poster wall last, both collapsed.
 *
 * An empty group is not rendered at all. Four headings with nothing under three
 * of them is a screen that looks broken on the club's first night. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Događaji",
  robots: { index: false, follow: false, nocache: true },
};

export default async function AdminEventsPage() {
  await requireStaff("admin");

  const all = await allTicketingEvents();
  const now = new Date();

  const operational = all.filter(isOperational);
  /* Most recent first — a wall, not a work list. */
  const posters = all
    .filter((event) => !isOperational(event))
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt));

  const summaries = await reportSummaries(operational);

  const cards = operational.map((event) => {
    const summary = summaries.get(event.id);
    return toCard(
      event,
      {
        capacity: event.capacity,
        paid: summary?.ticketsPaid ?? 0,
        available: summary?.available ?? event.capacity,
        taken: (summary?.ticketsPaid ?? 0) + (summary?.ticketsHeld ?? 0),
      },
      now,
    );
  });

  const grouped = groupEvents(cards);
  const working: EventGroup[] = ["active", "draft", "finished"];
  const nothingAtAll = cards.length === 0;

  return (
    <>
      <PageHeader
        title="Događaji"
        lede="Sve što se menja na jednom mestu: datum, poster, karte, stolovi. Novo veče se pravi za minut."
        action={
          <Link
            href="/admin/dogadjaji/novi"
            className="adm-btn adm-btn--primary adm-btn--sm"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Novi događaj
          </Link>
        }
      />

      {nothingAtAll ? (
        <Panel>
          <Empty
            action={
              <Link href="/admin/dogadjaji/novi" className="adm-btn adm-btn--primary">
                Napravi prvo veče
              </Link>
            }
          >
            Još nema nijednog događaja koji vodi ovaj sistem.
          </Empty>
        </Panel>
      ) : null}

      {working.map((group) =>
        grouped[group].length > 0 ? (
          <Panel
            key={group}
            title={GROUP_LABELS[group]}
            action={
              <span className="adm-figure text-[0.75rem] text-[var(--adm-ink-3)]">
                {grouped[group].length}
              </span>
            }
          >
            <ul>
              {grouped[group].map((card) => (
                <EventCard
                  key={card.event.id}
                  card={card}
                  summary={summaries.get(card.event.id)}
                />
              ))}
            </ul>
          </Panel>
        ) : null,
      )}

      {/* Shut by default and one tap from open. Nothing in here is urgent; it
          is where a night goes when the club has finished with it. */}
      {grouped.archived.length > 0 ? (
        <details className="adm-panel mb-5">
          <summary className="adm-panel-head cursor-pointer list-none">
            <h2 className="adm-panel-title">{GROUP_LABELS.archived}</h2>
            <span className="adm-figure text-[0.75rem] text-[var(--adm-ink-3)]">
              {grouped.archived.length}
            </span>
          </summary>
          <ul>
            {grouped.archived.map((card) => (
              <EventCard
                key={card.event.id}
                card={card}
                summary={summaries.get(card.event.id)}
              />
            ))}
          </ul>
        </details>
      ) : null}

      {/* ── the poster wall ──────────────────────────────────────────────
       *
       * NOT AN EVENT LIST, AND DELIBERATELY NOT SHAPED LIKE ONE. These are the
       * nights the club put on before this software existed. They keep their
       * artwork, their name and their date, and they carry no figures at all —
       * because there are none, and printing a column of zeros beside them is
       * exactly the fiction the whole separation exists to prevent. */}
      {posters.length > 0 ? (
        <details className="adm-panel mb-5">
          <summary className="adm-panel-head cursor-pointer list-none">
            <h2 className="adm-panel-title">Arhiva postera</h2>
            <span className="adm-figure text-[0.75rem] text-[var(--adm-ink-3)]">
              {posters.length}
            </span>
          </summary>
          <p className="border-b border-[var(--adm-line-soft)] px-[1.125rem] py-3 text-[0.75rem] leading-relaxed text-[var(--adm-ink-4)]">
            Žurke održane pre nego što je klub počeo da koristi ovaj sistem. Za
            njih ne postoje porudžbine, ulaznice, skeniranja ni rezervacije, pa
            nemaju ni izveštaj. Stoje u javnoj arhivi na /žurke.
          </p>
          <ul>
            {posters.map((event) => (
              <LegacyRow key={event.id} event={event} />
            ))}
          </ul>
        </details>
      ) : null}
    </>
  );
}
