"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Ambient } from "@/components/ambient";
import { Arrow } from "@/components/arrow";
import { LightSweep } from "@/components/light-sweep";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Lockup } from "@/components/lockup";
import { SectionWord } from "@/components/section-word";
import { EASE } from "@/components/reveal";
import { useLang } from "@/components/providers/language";
import type { MessageKey } from "@/lib/i18n";

/* The room the six information pages stand in.
 *
 * Always night, the way the archive rooms are, and lit the same way the
 * concierge section on the home page is lit — the same purple-black, the same
 * lamps, the same haze — so opening a card reads as walking further into the
 * club rather than leaving it. There is no navigation bar: the way back is a
 * hairline at the top left and the house mark at the top right, and the way
 * back goes to the six cards rather than to the top of the home page.
 *
 * WHERE IT COMES BACK OUT. Not `#info` — that is the concierge section, and
 * the section begins with five thousand pixels of pinned questions, so
 * anchoring to it would land a returning visitor on the first question rather
 * than on the cards they were looking at a moment ago. `#info-cards` is the
 * last frame of that pin; see the marker in components/sections/local-info.tsx.
 *
 * The headline is two lines because it was written as two lines. A single
 * string left to wrap would break wherever the measure happened to put it, and
 * that is not the same thing — RESTORANI / U INĐIJI. is a composition. */

const BACK = "/#info-cards";

export function InfoShell({
  word,
  titleA,
  titleB,
  children,
}: {
  /* The word standing behind the page, the way each section has one. */
  word: string;
  titleA: MessageKey;
  titleB: MessageKey;
  children: React.ReactNode;
}) {
  const { t } = useLang();
  const reduced = useReducedMotion();

  return (
    <main
      id="main"
      className="relative isolate min-h-[100svh] overflow-x-clip bg-night pb-32 text-night-ink md:pb-48"
    >
      {/* The house's ghost word, held back a little further than a section
          holds it. A section carries this behind photography; here it drifts
          across body copy and a directory of addresses, and at full strength
          it reads through the first row's name. */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.55]">
        <SectionWord word={word} speed={0.72} />
      </div>
      <Ambient variant="soft" />

      <div className="container-x relative z-10">
        <motion.div
          initial={reduced ? false : { opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduced ? 0 : 0.9, ease: EASE }}
          className="flex items-start justify-between pt-10 md:pt-14"
        >
          <BackToInfo label={t("info.page.back")} />

          {/* THE LANGUAGE BELONGS ON THESE PAGES, unlike the archive rooms
              they are modelled on. Those are reached from the home page, where
              the choice was already made; a directory of addresses is the one
              thing on this site a visitor is likely to arrive at cold, from a
              search or from someone else's link, and there is no navigation
              bar here to carry the switch. It is the site's own switcher and
              the site's own stored choice — see providers/language.tsx. */}
          <div className="flex items-center gap-6 sm:gap-8">
            <LanguageSwitcher tone="night" />

            <Link
              href="/"
              aria-label={`Plitvice — ${t("common.toTop")}`}
              className="text-night-ink transition-colors duration-500 hover:text-gold"
            >
              <Lockup size="xs" tone="light" />
            </Link>
          </div>
        </motion.div>

        {/* No light rig in here. `LightLeaks` clips to its own box, and on a
            page with no photography on it the box is visible: a paler
            rectangle exactly the width of the container with two hard vertical
            edges down the sides of the headline. `Ambient` on the page itself
            is unbounded and does the same job without the seam. */}
        <header className="relative pt-24 md:pt-36">
          <motion.div
            initial={reduced ? false : { opacity: 0, y: 26 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduced ? 0 : 1.1, delay: 0.1, ease: EASE }}
            className="relative z-10"
          >
            <p className="rail rail-night">{t("info.page.eyebrow")}</p>

            <h1 className="mt-7 font-serif uppercase leading-[0.95] tracking-[-0.015em] text-[clamp(2.5rem,8vw,6rem)]">
              <LightSweep>
                <span className="block">{t(titleA)}</span>
                <span className="block text-night-ink/55">{t(titleB)}</span>
              </LightSweep>
            </h1>
          </motion.div>
        </header>
      </div>

      <div className="relative z-10 mt-14 md:mt-20">{children}</div>

      {/* and the way back again, for anyone who read to the bottom */}
      <div className="container-x relative z-10 mt-24 md:mt-36">
        <div className="h-px w-full bg-gold/15" aria-hidden="true" />
        <div className="mt-10">
          <BackToInfo label={t("info.page.back")} />
        </div>
      </div>
    </main>
  );
}

/* The way out. An arrow pointing back rather than a browser chevron, set at
   the weight of every other rail on the site, and it says where it goes rather
   than saying "back". */
function BackToInfo({ label }: { label: string }) {
  return (
    <Link
      href={BACK}
      className="group inline-flex items-center gap-3 text-[0.625rem] uppercase tracking-[0.3em] text-night-ink/50 outline-none transition-colors duration-500 hover:text-gold focus-visible:text-gold"
    >
      <Arrow className="w-6 rotate-180 group-hover:w-9 group-focus-visible:w-9" />
      {label}
    </Link>
  );
}
