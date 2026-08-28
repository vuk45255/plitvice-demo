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

export default function Home() {
  return (
    <>
      <SkipLink />
      <SiteHeader />
      <main id="main">
        <Hero />
        <Events />
        <Portals />
        {/* the signature band — and the one door on the home page into the
            story of the house, which has a page of its own at /o-nama */}
        <Interlude />
        <Vip />
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
