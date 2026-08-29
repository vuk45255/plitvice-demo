import Link from "next/link";
import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { Empty, PageHeader, Panel } from "@/components/admin/shell";
import { EventCard } from "@/components/admin/event-card";
import { allTicketingEvents } from "@/lib/ticketing/events";
import { countsFor } from "@/lib/ticketing/store";
import {
  GROUP_LABELS,
  groupEvents,
  toCard,
  type EventGroup,
} from "@/lib/club/event-manager";
import { requireStaff } from "@/lib/staff/guard";

/* /admin/dogadjaji — THE PROGRAMME.
 *
 * ═══ THREE GROUPS AND A DRAWER ════════════════════════════════════════════
 *
 * AKTIVNI first, because it is what the club is working on tonight. DRAFT
 * second, because those are the ones somebody has started and not finished and
 * they should nag. ZAVRŠENI third, read the next afternoon for the figures.
 * ARHIVA last and collapsed, because it is where nights go to stop being in
 * the way — a `<details>` rather than a second page, so it is one tap away and
 * costs nothing when it is shut.
 *
 * An empty group is not rendered at all. Four headings with nothing under
 * three of them is a screen that looks broken on the club's first night.
 *
 * ═══ WHAT REPLACED WHAT ═══════════════════════════════════════════════════
 *
 * This used to be a "next night" hero, a card list for phones, an eight-column
 * table for laptops, and a create form pinned to the bottom. The table could
 * not hold a poster and the column that mattered was always the name; the form
 * at the bottom meant every visit to the list scrolled past the whole
 * programme. Now: one card shape that reflows, and NOVI DOGAĐAJ is a button
 * that goes to its own screen.
 *
 * SOLD AND REMAINING ARE STILL COUNTED PER NIGHT, in one query each. There is
 * no stored total anywhere in this system — see `countsFor`. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Događaji",
  robots: { index: false, follow: false, nocache: true },
};

export default async function AdminEventsPage() {
  await requireStaff("admin");

  const events = await allTicketingEvents();
  const now = new Date();

  const cards = await Promise.all(
    events.map(async (event) => toCard(event, await countsFor(event.id), now)),
  );
  const grouped = groupEvents(cards);

  const working: EventGroup[] = ["active", "draft", "finished"];
  const nothingAtAll = cards.length === 0;

  return (
    <>
      <PageHeader
        eyebrow="Program"
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
            Još nema nijednog događaja.
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
                <EventCard key={card.event.id} card={card} />
              ))}
            </ul>
          </Panel>
        ) : null,
      )}

      {/* Shut by default and one tap from open. Nothing in here is urgent; it
          is where a night goes when the club has finished with it. */}
      {grouped.archived.length > 0 ? (
        <details className="adm-panel mb-6">
          <summary className="adm-panel-head cursor-pointer list-none">
            <h2 className="adm-panel-title">{GROUP_LABELS.archived}</h2>
            <span className="adm-figure text-[0.75rem] text-[var(--adm-ink-3)]">
              {grouped.archived.length}
            </span>
          </summary>
          <ul>
            {grouped.archived.map((card) => (
              <EventCard key={card.event.id} card={card} />
            ))}
          </ul>
        </details>
      ) : null}
    </>
  );
}
