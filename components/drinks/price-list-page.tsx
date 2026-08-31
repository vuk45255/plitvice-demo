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
import { PriceList } from "@/components/drinks/price-list";
import { useLang } from "@/components/providers/language";

/* The price list — the room behind the band on the home page.
 *
 * Lit exactly the way the six information pages are lit, and for the same
 * reason: opening it should read as walking further into the club rather than
 * leaving it. No navigation bar, the way back at the top left, the house mark
 * at the top right, and the same line the band asks standing at the top of it
 * in the same italic serif.
 *
 * The list itself is components/drinks/price-list.tsx and every drink and
 * every price on it is lib/drinks-menu.ts — the club's own printed cenovnik,
 * transcribed and nothing else. This file is only the room it stands in. */

const BACK = "/#pice";

export function PriceListPage() {
  const { t } = useLang();
  const reduced = useReducedMotion();

  return (
    <main
      id="main"
      className="section-word-host relative isolate min-h-[100svh] overflow-clip bg-night pb-32 text-night-ink md:pb-48"
    >
      {/* The house's ghost word, held back the way it is on the information
          pages — this is body copy and a table of numbers, not photography. */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.55]">
        <SectionWord word="Bar" speed={0.72} />
      </div>
      <Ambient variant="soft" />

      <div className="container-x relative z-10">
        <motion.div
          initial={reduced ? false : { opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduced ? 0 : 0.9, ease: EASE }}
          className="flex items-start justify-between pt-10 md:pt-14"
        >
          <BackToBand label={t("drinks.page.back")} />

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

        <header className="relative pt-24 md:pt-36">
          <motion.div
            initial={reduced ? false : { opacity: 0, y: 26 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduced ? 0 : 1.1, delay: 0.1, ease: EASE }}
            className="relative z-10"
          >
            <p className="rail rail-night">{t("drinks.page.eyebrow")}</p>

            <h1 className="mt-7 font-serif text-[clamp(2.5rem,8vw,5.5rem)] italic leading-[1.02] tracking-[-0.015em]">
              <LightSweep>{t("drinks.title")}</LightSweep>
            </h1>
          </motion.div>
        </header>

        {/* The stage. Two gold hairlines and the whole list between them.
            Wider than a magazine measure on purpose — the list is two columns
            on a desktop and each row has to hold a name, a measure, a run of
            dots and a price without any of them crowding. */}
        <section
          aria-label={t("drinks.page.listLabel")}
          className="relative z-10 mt-16 md:mt-24"
        >
          <motion.div
            initial={reduced ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduced ? 0 : 1, delay: 0.24, ease: EASE }}
            className="mx-auto max-w-[1180px]"
          >
            <div className="h-px w-full bg-gold/15" aria-hidden="true" />
            <div className="py-16 md:py-24">
              <PriceList />
            </div>
            <div className="h-px w-full bg-gold/15" aria-hidden="true" />
          </motion.div>
        </section>

        {/* and the way back again, for anyone who read to the bottom */}
        <div className="relative z-10 mt-24 md:mt-36">
          <BackToBand label={t("drinks.page.back")} />
        </div>
      </div>
    </main>
  );
}

/* Back to the band it was opened from rather than to the top of the home
   page — the same manners the information pages have. */
function BackToBand({ label }: { label: string }) {
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
