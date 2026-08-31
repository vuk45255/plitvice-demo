"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Ambient } from "@/components/ambient";
import { LightLeaks } from "@/components/light-leaks";
import { SectionWord } from "@/components/section-word";
import { LightSweep } from "@/components/light-sweep";
import { Lockup } from "@/components/lockup";
import { EASE } from "@/components/reveal";
import { useLang } from "@/components/providers/language";
import type { MessageKey } from "@/lib/i18n";

/* The room every archive page stands in.
 *
 * These pages are always night, whichever way the theme toggle sits — the same
 * purple-black, the same lamps, the same haze and grain as the sections they
 * were opened from, so walking through the window never feels like leaving the
 * club. The way back is a hairline at the top left and the house mark at the
 * top right; there is no navigation bar to compete with the photography. */

type ArchiveShellProps = {
  /* The word standing behind the page, the way each section has one. */
  word: string;
  title: MessageKey;
  lead: MessageKey;
  caption: MessageKey;
  children: React.ReactNode;
};

export function ArchiveShell({
  word,
  title,
  lead,
  caption,
  children,
}: ArchiveShellProps) {
  const { t, tRich } = useLang();
  const reduced = useReducedMotion();

  return (
    <main
      id="main"
      className="section-word-host relative isolate min-h-[100svh] overflow-hidden bg-night pb-32 text-night-ink md:pb-48"
    >
      <SectionWord word={word} />
      <Ambient variant="soft" />

      <div className="container-x relative z-10">
        {/* the way out, and the mark — nothing else along the top */}
        <motion.div
          initial={reduced ? false : { opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduced ? 0 : 0.9, ease: EASE }}
          className="flex items-start justify-between pt-10 md:pt-14"
        >
          <Link
            href="/"
            className="group flex items-center gap-3 text-[0.625rem] uppercase tracking-[0.3em] text-night-ink/50 transition-colors duration-500 hover:text-gold"
          >
            <span
              className="h-px w-6 bg-current transition-[width] duration-500 group-hover:w-9"
              aria-hidden="true"
            />
            {t("common.back")}
          </Link>

          <Link
            href="/"
            aria-label={`${t("common.back")} — Plitvice`}
            className="text-night-ink transition-colors duration-500 hover:text-gold"
          >
            <Lockup size="xs" tone="light" />
          </Link>
        </motion.div>

        {/* the title block. Rail, serif, rail — the house hierarchy. */}
        <header className="relative pt-24 md:pt-36">
          <LightLeaks intensity="soft" />

          <motion.div
            initial={reduced ? false : { opacity: 0, y: 26 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduced ? 0 : 1.1, delay: 0.1, ease: EASE }}
            className="relative z-10"
          >
            <p className="rail rail-night">{t(caption)}</p>
            <h1 className="mt-7 font-serif text-[clamp(2.5rem,7vw,6rem)] leading-[0.98] tracking-tight">
              <LightSweep>{tRich(title)}</LightSweep>
            </h1>
            <p className="mt-10 max-w-[34rem] text-base leading-[1.8] text-night-ink/60">
              {t(lead)}
            </p>
          </motion.div>
        </header>
      </div>

      <div className="relative z-10 mt-24 md:mt-36">{children}</div>

      {/* and the way out again, for anyone who read to the bottom */}
      <div className="container-x relative z-10 mt-28 md:mt-40">
        <div className="h-px w-full bg-gold/15" aria-hidden="true" />
        <Link
          href="/"
          className="group mt-10 flex items-center gap-3 text-[0.625rem] uppercase tracking-[0.3em] text-night-ink/50 transition-colors duration-500 hover:text-gold"
        >
          <span
            className="h-px w-6 bg-current transition-[width] duration-500 group-hover:w-9"
            aria-hidden="true"
          />
          {t("common.back")}
        </Link>
      </div>
    </main>
  );
}
