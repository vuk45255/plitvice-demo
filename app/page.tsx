import { SiteHeader } from "@/components/site-header";
import { SkipLink } from "@/components/skip-link";
import Hero from "@/components/hero";
import { About } from "@/components/sections/about";
import { Events } from "@/components/sections/events";
import { Gallery } from "@/components/sections/gallery";
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
        <Gallery />
        {/* the signature band, leading straight into the story it belongs to */}
        <Interlude />
        <About />
        <Vip />
        <Location />
      </main>
      <SiteFooter />
    </>
  );
}
