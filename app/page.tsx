import { SiteHeader } from "@/components/site-header";
import { SkipLink } from "@/components/skip-link";
import Hero from "@/components/hero";
import { Events } from "@/components/sections/events";
import { Portals } from "@/components/sections/portals";
import { Interlude } from "@/components/sections/interlude";
import { Vip } from "@/components/sections/vip";
import { Location } from "@/components/sections/location";
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
        <Location />
      </main>
      <SiteFooter />
    </>
  );
}
