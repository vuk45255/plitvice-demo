import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";
import { Notice, PageHeader, Panel } from "@/components/admin/shell";
import { Badge } from "@/components/admin/badge";
import { findTicketingEvent } from "@/lib/ticketing/events";
import { countsFor } from "@/lib/ticketing/store";
import { eventTiers, posterUrl, toCard } from "@/lib/club/event-manager";
import { eventDate, eventTime, price } from "@/lib/ticketing/copy";
import { requireStaff } from "@/lib/staff/guard";

/* PREGLED — what a guest is going to be told about this night.
 *
 * ═══ THE HONEST VERSION OF A PREVIEW ══════════════════════════════════════
 *
 * The temptation is to render the public site's own components in here. It is
 * the wrong move twice over.
 *
 * FIRST, THE ARCHITECTURE FORBIDS IT, and for a reason this project cares
 * about a great deal: nothing under app/(operations)/ imports the public site.
 * A doorman's phone on one bar of signal must not download a translation
 * dictionary, a scroll library and an entrance ceremony in order to look at a
 * list. Pulling the poster wall in here to draw a preview would put every one
 * of those into the office's bundle. See app/(operations)/layout.tsx.
 *
 * SECOND, IT WOULD NOT BE A PREVIEW ANYWAY. The public wall is a cinematic
 * thing built out of motion and light; a still copy of it in an office
 * stylesheet is a drawing of a preview, and it would drift the first time
 * anybody touched either side.
 *
 * ═══ SO: TWO ANSWERS, AND NEITHER OF THEM DRIFTS ══════════════════════════
 *
 * 1. THE REAL PAGE, one tap away. For a published night, OTVORI JAVNU STRANICU
 *    opens the actual public page at the actual public URL. That cannot drift
 *    from the public design because it IS the public design. It is the primary
 *    action here.
 *
 * 2. THE FACTS, listed. Below that, every field a guest will be shown, read
 *    from the same row the site reads — poster, date, doors, price, age, dress
 *    code, promotion — so somebody can check the night is complete BEFORE
 *    publishing it, which is the moment a draft has no public page to open.
 *    It is deliberately a checklist and not an imitation: it never pretends to
 *    be what the night will look like, only what the night says.
 *
 * WHAT IS MISSING IS THE POINT OF THE SCREEN. Every line that has no value
 * says so in the same grey, rather than being hidden — this is the one place
 * where an absent dress code should be visible, because somebody is here to
 * find out what they have not filled in yet. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

export default async function EventPreviewPage({
  params,
}: PageProps<"/admin/dogadjaji/[id]/pregled">) {
  await requireStaff("admin");
  const { id } = await params;

  const event = await findTicketingEvent(id, true);
  if (!event) notFound();

  const counts = await countsFor(event.id);
  const card = toCard(event, counts);
  const poster = posterUrl(event);
  const tiers = eventTiers(event);
  const live = event.status !== "draft" && !event.archivedAt;

  return (
    <>
      <PageHeader
        eyebrow="Pregled"
        title={event.title}
        lede="Ovo su podaci koje gost vidi. Proverite ih pre objave."
        action={
          <>
            <Link href={`/admin/dogadjaji/${event.id}`} className="adm-btn adm-btn--sm">
              Nazad na uređivanje
            </Link>
            {live ? (
              /* THE ACTUAL PUBLIC PAGE. Not a copy of it. */
              <a
                href={`/rezervacija?event=${encodeURIComponent(event.slug)}`}
                target="_blank"
                rel="noreferrer"
                className="adm-btn adm-btn--sm adm-btn--primary"
              >
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                Otvori javnu stranicu
              </a>
            ) : null}
          </>
        }
      />

      {!live ? (
        <div className="mb-6">
          <Notice>
            {event.archivedAt
              ? "Veče je arhivirano, pa nema javnu stranicu."
              : "Veče je još draft, pa još nema javnu stranicu. Ispod je sve što će gost videti kada ga objavite."}
          </Notice>
        </div>
      ) : null}

      <Panel title="Kako veče stoji">
        <div className="flex flex-wrap items-center gap-2 px-[1.125rem] py-5">
          <Badge kind="event" value={event.status} />
          {event.ticketingEnabled ? (
            <Badge kind="sale" value={card.sale.open ? "open" : card.sale.reason} />
          ) : (
            <span className="text-[0.75rem] text-[var(--adm-ink-3)]">
              Ulaz se naplaćuje na vratima
            </span>
          )}
          {event.tablesEnabled ? (
            <span className="text-[0.75rem] text-[var(--adm-ink-3)]">
              Rezervacije stolova su otvorene
            </span>
          ) : (
            <span className="text-[0.75rem] text-[var(--adm-ink-4)]">
              Bez rezervacije stolova
            </span>
          )}
        </div>
      </Panel>

      <Panel title="Šta gost vidi">
        <div className="grid gap-6 px-[1.125rem] py-5 sm:grid-cols-[14rem_1fr]">
          <div className="adm-event-poster">
            {poster ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={poster} alt={`Poster — ${event.title}`} />
            ) : (
              <span className="adm-event-poster-empty">Nema postera</span>
            )}
          </div>

          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <Line label="Naziv" value={event.title} />
            <Line label="Datum" value={eventDate(event.startsAt)} />
            <Line label="Početak" value={eventTime(event.startsAt)} />
            <Line
              label="Vrata"
              value={event.doorsAt ? eventTime(event.doorsAt) : undefined}
            />
            <Line label="DJ / izvođač" value={event.lineup} />
            <Line label="Žanr" value={event.genre} />
            <Line label="Starosno ograničenje" value={event.ageRestriction} />
            <Line label="Dress code" value={event.dressCode} />
            <Line label="Napomena o ulazu" value={event.entryNote} />
            <Line label="Promocija" value={event.promotion} />
            <Line label="Opis" value={event.description} wide />
          </dl>
        </div>
      </Panel>

      {event.ticketingEnabled ? (
        <Panel title="Ulaznice">
          <ul>
            {tiers.map((tier) => (
              <li
                key={tier.id}
                className="adm-row flex flex-wrap items-center justify-between gap-x-6 gap-y-2"
              >
                <span className="text-[0.875rem] text-[var(--adm-ink)]">
                  {tier.name}
                </span>
                <span className="adm-figure text-[0.875rem] text-[var(--adm-gold-light)]">
                  {tier.price > 0 ? price(tier.price) : "Cena nije podešena"}
                  <span className="ml-3 text-[0.75rem] text-[var(--adm-ink-4)]">
                    {counts.paid} / {tier.capacity} prodato
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </>
  );
}

/* One fact, or the honest absence of one. A missing value is shown as missing
   rather than hidden — finding out what is not filled in yet is the reason
   somebody opened this screen. */
function Line({
  label,
  value,
  wide,
}: {
  label: string;
  value?: string;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="adm-label">{label}</dt>
      <dd
        className={`mt-1.5 text-[0.875rem] leading-relaxed ${
          value ? "text-[var(--adm-ink)]" : "text-[var(--adm-ink-4)]"
        }`}
      >
        {value || "nije uneto"}
      </dd>
    </div>
  );
}
