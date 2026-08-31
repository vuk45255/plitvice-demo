"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useLenis } from "lenis/react";
import { Lockup } from "@/components/lockup";
import { MobileHeader } from "@/components/site-header-mobile";
import { SocialLinks } from "@/components/social-links";
import { LanguageSwitcher } from "@/components/language-switcher";
import { EASE } from "@/components/reveal";
import { useEntrance } from "@/components/providers/entrance";
import { useLang } from "@/components/providers/language";
import { ReserveButton } from "@/components/reservation/reserve-button";
import { useScrollLock } from "@/lib/scroll-lock";
import { travelTo, travelToHash } from "@/lib/scroll";
import { useScrolledPast } from "@/lib/use-scrolled";
import { navigation, site } from "@/lib/site";

/* Doorman's layout: the menu on the left, the house mark dead centre, the
   reservation and the language on the right. Nothing else.

   One structural rule worth keeping: the entrance blur is applied to the bar
   wrapper, never to <header> itself. A filter on an ancestor becomes the
   containing block for its fixed-position descendants, which would pin the
   panel to the height of the bar and swallow every click inside it. */
const navItem =
  "inline-block py-1 font-serif text-[clamp(1.75rem,6vw,2.25rem)] leading-tight text-night-ink transition-colors duration-500 hover:text-gold";

export function SiteHeader() {
  /* The bar is the same bar everywhere. The one thing it has to know is
     whether the page under it is one of the always-night ones: there its
     surface, its mark and its rules carry the night's colours whichever way
     the theme toggle sits, and its "#" doors lead back to that place on the
     home page rather than at nothing. */
  const night = usePathname() !== "/";
  const [open, setOpen] = useState(false);
  const { entered } = useEntrance();
  const { t } = useLang();
  const reduced = useReducedMotion();

  /* WHERE THE BAR'S SURFACE COMES FROM. Asked of the page's own scroll
     position rather than of Lenis, because Lenis is only mounted on a desk —
     see components/providers/smooth-scroll.tsx — and because the page's scroll
     event says the same thing on both. Passive, coalesced onto a frame, and
     compared before React is entered. See lib/use-scrolled.ts. */
  const scrolled = useScrolledPast(32);
  /* Still wanted for the travelling: on a desk Lenis does the journey, and
     where it is absent the browser's own smooth scrolling does. */
  const lenis = useLenis();

  /* Nothing behind the open panel moves — see lib/scroll-lock.ts — and Escape
     always closes it. */
  useScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  /* Close first, then travel — the scroll runs against an unlocked page. */
  const goTo = (hash: string) => {
    setOpen(false);
    window.setTimeout(() => travelToHash(hash, lenis), 120);
  };

  /* The first viewport belongs to the club alone — no nav, no reservation
     button, no language. The chrome is not rendered at all until the mark has
     finished revealing, then it arrives out of a blur. */
  if (!entered) return null;

  return (
    <>
      {/* The phone has its own door — a floating card and a full-height panel,
          in components/site-header-mobile.tsx. Everything below is the wide
          bar, and it starts at `md`. */}
      <MobileHeader />

      <header className="fixed inset-x-0 top-0 z-50 hidden md:block">
        <AnimatePresence>
          {open && (
            <>
              <motion.button
                type="button"
                aria-label={t("common.closeMenu")}
                onClick={() => setOpen(false)}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduced ? 0 : 0.5, ease: EASE }}
                className="fixed inset-0 cursor-default bg-night/75 backdrop-blur-[2px]"
              />

              <motion.div
                id="main-menu"
                initial={reduced ? { opacity: 0 } : { x: "-100%" }}
                animate={reduced ? { opacity: 1 } : { x: 0 }}
                exit={reduced ? { opacity: 0 } : { x: "-100%" }}
                transition={{ duration: reduced ? 0 : 0.65, ease: EASE }}
                /* Stopped Lenis eats touchmove; this drawer scrolls itself.
                   See the note in components/reservation/reservation-gate.tsx. */
                data-lenis-prevent
                className="fixed inset-y-0 left-0 flex w-[88%] max-w-[380px] flex-col justify-between overflow-y-auto border-r border-line bg-night px-8 pb-12 pt-24 text-night-ink sm:w-[380px] md:pt-28"
              >
                {/* one lamp in the far corner, and a little haze under it */}
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background:
                      "radial-gradient(70% 45% at 100% 0%, rgba(122,72,180,0.34), transparent 70%), radial-gradient(60% 40% at 0% 100%, rgba(200,164,93,0.10), transparent 72%)",
                  }}
                  aria-hidden="true"
                />
                {!reduced && (
                  <motion.div
                    className="pointer-events-none absolute inset-0 [filter:blur(70px)]"
                    style={{
                      background:
                        "radial-gradient(50% 35% at 40% 55%, rgba(168,148,202,0.10), transparent 72%)",
                    }}
                    animate={{ opacity: [0.5, 1, 0.5], scale: [1, 1.1, 1] }}
                    transition={{
                      duration: 14,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                    aria-hidden="true"
                  />
                )}

                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.7, delay: 0.15 }}
                  className="relative"
                  aria-hidden="true"
                >
                  <Lockup size="xs" tone="light" />
                </motion.div>

                <nav aria-label="Plitvice" className="relative py-12">
                  <ul className="space-y-4">
                    {navigation.map((item, i) => (
                      <motion.li
                        key={item.href}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{
                          duration: reduced ? 0 : 0.6,
                          delay: reduced ? 0 : 0.18 + i * 0.07,
                          ease: EASE,
                        }}
                      >
                        {/* "#" entries travel down the page; the rest are real
                            destinations and stay real links. */}
                        {item.href.startsWith("#") && !night ? (
                          <a
                            href={item.href}
                            onClick={(e) => {
                              e.preventDefault();
                              goTo(item.href);
                            }}
                            className={navItem}
                          >
                            {t(item.label)}
                          </a>
                        ) : (
                          <Link
                            href={
                              item.href.startsWith("#")
                                ? `/${item.href}`
                                : item.href
                            }
                            onClick={() => setOpen(false)}
                            className={navItem}
                          >
                            {t(item.label)}
                          </Link>
                        )}
                      </motion.li>
                    ))}
                  </ul>
                </nav>

                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{
                    duration: reduced ? 0 : 0.7,
                    delay: reduced ? 0 : 0.45,
                    ease: EASE,
                  }}
                  className="relative border-t border-line pt-8"
                >
                  <p className="rail rail-night">
                    {site.street} · {site.town}
                  </p>
                  <SocialLinks tone="night" className="mt-5" />
                </motion.div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* the bar sits above the panel, so the X is always reachable */}
        <motion.div
          initial={reduced ? false : { opacity: 0, y: -14, filter: "blur(14px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{
            duration: reduced ? 0 : 1.4,
            delay: reduced ? 0 : 0.35,
            ease: EASE,
          }}
          className="relative"
        >
          <div
            className={`transition-[background-color,border-color,backdrop-filter] duration-700 ${
              scrolled && !open
                ? `border-b border-line backdrop-blur-md ${
                    night ? "bg-night/75" : "bg-surface/70"
                  }`
                : "border-b border-transparent bg-transparent"
            }`}
          >
            <div className="container-x relative flex h-16 items-center md:h-20">
              {/* one button, two states: the bars cross into an X in place */}
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                aria-controls="main-menu"
                aria-label={open ? t("common.closeMenu") : t("common.openMenu")}
                className="group flex h-9 w-9 items-center"
              >
                <span className="relative block h-4 w-6">
                  <motion.span
                    className={`absolute left-0 top-[5px] block h-px w-6 origin-center transition-colors duration-500 group-hover:bg-accent ${
                      open || night ? "bg-night-ink" : "bg-ink"
                    }`}
                    animate={{ rotate: open ? 45 : 0, y: open ? 2.5 : 0 }}
                    transition={{ duration: reduced ? 0 : 0.45, ease: EASE }}
                  />
                  <motion.span
                    className={`absolute left-0 top-[10px] block h-px w-6 origin-center transition-colors duration-500 group-hover:bg-accent ${
                      open || night ? "bg-night-ink" : "bg-ink"
                    }`}
                    animate={{ rotate: open ? -45 : 0, y: open ? -2.5 : 0 }}
                    transition={{ duration: reduced ? 0 : 0.45, ease: EASE }}
                  />
                </span>
              </button>

              {/* dead centre, whatever sits on either side of it */}
              <a
                href="#main"
                onClick={(e) => {
                  e.preventDefault();
                  setOpen(false);
                  travelTo(0, lenis, false, 1.4);
                }}
                aria-label={`${site.tagline} ${site.name}, ${site.town} — ${t("common.toTop")}`}
                className={`absolute left-1/2 -translate-x-1/2 transition-colors duration-500 ${
                  open || night ? "text-night-ink" : "text-ink"
                }`}
              >
                <Lockup size="xs" />
              </a>

              {/* On a phone the bar is three things only — menu, mark, language.
                  The reservation would crowd the centred lockup, so it lives in
                  the panel instead (navigation carries it). */}
              <div className="ml-auto flex items-center gap-3 md:gap-5">
                <div className="hidden md:block">
                  <ReserveButton night={night} />
                </div>
                <LanguageSwitcher tone={night || open ? "night" : "ink"} />
              </div>
            </div>
          </div>
        </motion.div>
      </header>
    </>
  );
}
