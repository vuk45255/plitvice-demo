import Link from "next/link";
import type { Metadata } from "next";
import { Empty, PageHeader, Panel } from "@/components/admin/shell";
import { FloorMap } from "@/components/admin/floor-map";
import { bookableNights } from "@/lib/reservations/gate";
import { floorState } from "@/lib/reservations/admin";
import { requireStaff } from "@/lib/staff/guard";

/* /admin/plan — the room, as it stands this second.
 *
 * The list on /admin/rezervacije answers "who is coming"; this answers "what is
 * left", which is the question staff are actually asked on the telephone. Same
 * rows underneath — one `floorState` — so the two can never disagree.
 *
 * The night is chosen with a plain GET form, so a view is a URL that staff can
 * send each other and the back button works. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Plan stolova",
  robots: { index: false, follow: false, nocache: true },
};

export default async function AdminFloorPage({
  searchParams,
}: PageProps<"/admin/plan">) {
  await requireStaff("admin");

  const params = await searchParams;
  const nights = await bookableNights();
  const chosen =
    (typeof params.event === "string" &&
      nights.find((event) => event.slug === params.event)) ||
    nights[0];

  if (!chosen) {
    return (
      <>
        <PageHeader eyebrow="Sala" title="Plan stolova" />
        <Panel>
          <Empty>Nijedno veče trenutno ne prima rezervacije stolova.</Empty>
        </Panel>
      </>
    );
  }

  const floor = await floorState(chosen.slug);

  return (
    <>
      <PageHeader
        eyebrow="Sala"
        title="Plan stolova"
        lede="Stanje dolazi sa servera i osvežava se samo. Zadržani stolovi se oslobađaju sami kada istekne vreme."
        action={
          <Link
            href={`/admin/rezervacije?event=${encodeURIComponent(chosen.slug)}`}
            className="adm-btn adm-btn--sm"
          >
            Lista rezervacija
          </Link>
        }
      />

      <form method="get" className="mb-6 flex flex-wrap items-end gap-3 sm:gap-4">
        <label className="basis-[14rem]">
          <span className="adm-label">Veče</span>
          <select
            name="event"
            defaultValue={chosen.slug}
            className="adm-field adm-search mt-2"
          >
            {nights.map((event) => (
              <option key={event.slug} value={event.slug}>
                {event.title}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="adm-btn h-12">
          Prikaži
        </button>
      </form>

      <Panel title={chosen.title}>
        {/* The map refreshes itself every few seconds against the server; what
            is rendered here is only the first answer. */}
        <FloorMap initial={floor} eventSlug={chosen.slug} />
      </Panel>
    </>
  );
}
