import { SiteHeader } from "@/components/site-header";
import { SkipLink } from "@/components/skip-link";
import Hero from "@/components/hero";
import { Events } from "@/components/sections/events";
import { Portals } from "@/components/sections/portals";
import { Interlude } from "@/components/sections/interlude";
import { Vip } from "@/components/sections/vip";
import { Location } from "@/components/sections/location";
import { LocalInfo } from "@/components/sections/local-info";
import { DrinksBand } from "@/components/drinks/drinks-band";
import { SiteFooter } from "@/components/site-footer";
import { programme } from "@/lib/club/programme";

/* THE PROGRAMME IS READ HERE, ONCE, ON THE SERVER.
 *
 * The three sections below used to import a hand-written array. They now take
 * what this fetches, which is the `events` table that /admin/dogadjaji edits —
 * so the home page says what the office says, without a deploy and without a
 * second copy of a night anywhere.
 *
 * `force-dynamic` because the programme is now data rather than source: a
 * night published at eleven has to be on the wall at eleven, and a page cached
 * at build time would show whatever was true when the build ran. */
export const dynamic = "force-dynamic";

export default async function Home() {
  const { next, past, events } = await programme();
  const posters = events.map((event) => event.poster).filter((p) => p !== undefined);

  return (
    <>
      <SkipLink />
      <SiteHeader />
      <main id="main">
        <Hero />
        <Events next={next} past={past} />
        <Portals posters={posters} />
        {/* the signature band — and the one door on the home page into the
            story of the house, which has a page of its own at /o-nama */}
        <Interlude />
        <Vip next={next} />
        {/* The concierge: the town rather than the club, and one section
            rather than two — the TREBA VAM questions and the six pictures are
            the two halves of a single pinned scene inside it. */}
        <LocalInfo />
        {/* The back bar, a thin band between the two — the concierge ends on
            the six pictures, and the address begins under it. */}
        <DrinksBand />
        {/* And then the address itself, last, so the page ends on the door.
            It stands where the feed used to — see `wall` below. */}
        <Location />
      </main>
      {/* The home page ends on the address, so the feed under the mark comes
          off this page only. Every other page's footer is untouched, and so is
          every Instagram link on the site including the one in this footer. */}
      <SiteFooter wall={false} />
    </>
  );
}
