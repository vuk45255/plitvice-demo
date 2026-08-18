"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useLenis } from "lenis/react";
import { Arrow } from "@/components/arrow";
import { Lockup } from "@/components/lockup";
import { LanguageSwitcher } from "@/components/language-switcher";
import { SocialLinks } from "@/components/social-links";
import { EASE } from "@/components/reveal";
import { useLang } from "@/components/providers/language";
import { navigation, site } from "@/lib/site";

/* The door, as it is held on a phone.
 *
 * A card rather than a bar: it floats a finger's width in from all three edges,
 * dark and blurred, so the hero keeps running underneath it instead of being
 * cut off by a solid strip. The house mark holds the left, one word holds the
 * right, and that word is a word — "Meni" reads as an invitation where three
 * stacked lines read as a control panel.
 *
 * Opening does not bring a second object onto the screen. The same card, at the
 * same inset and with the same corner, unrolls to the full height of the phone,
 * and its own head — mark on the left, "Zatvori" on the right — lands exactly
 * where the closed one was. The nights are set down the middle of it in the
 * house serif, large enough that the whole menu is read at arm's length rather
 * than scanned.
 *
 * This is the phone alone. The wide bar, its centred mark and the drawer that
 * slides from the left are untouched and still own everything from `md` up. */

const PANEL_ID = "mobile-menu";

/* One inset and one corner, shared by the closed card and the open one — the
   two are the same object in two states, and any drift between these would
   break that. */
const EDGE = "inset-x-4";
const CORNER = "rounded-[22px]";
/* The head is the part that has to survive the opening unchanged. */
const HEAD = "flex h-[62px] shrink-0 items-center justify-between gap-4 pl-5 pr-2.5";
/* Menu and Close are the same control with a different word in it: a pill in
   the same small caps as every rail on the site. Menu is the one being looked
   for, so it carries the larger of the two; Close is already found by the time
   it is wanted and sits back a little — still a full thumb's width of pill. */
const CONTROL =
  "inline-flex items-center rounded-full border border-gold/30 uppercase text-night-ink/85 transition-colors duration-500 hover:border-gold/60 hover:text-gold-light active:border-gold/60 active:text-gold-light";
const CONTROL_MENU = "h-11 px-6 text-[0.625rem] tracking-[0.3em]";
const CONTROL_CLOSE = "h-10 px-5 text-[0.5625rem] tracking-[0.26em]";

/* The nights themselves. Warm white, never gold — the gold is saved for the one
   line that sells something. */
const LINK =
  "font-serif text-[clamp(2rem,8.5vw,2.875rem)] uppercase leading-[1.08] tracking-[0.03em]";

/* The phone's menu is the site's navigation with one more door in it: the
   room's own address. It is a section of the home page rather than a route, so
   it costs nothing to offer — and on a phone, where the footer is a long way
   down, it is the one thing a guest standing in the street actually wants.
   `navigation` itself is not touched; the wide bar keeps the four it has. */
const HERE = { label: "nav.location", href: "#location" } as const;
const doors = navigation.flatMap((item) =>
  item.label === "nav.about" ? [item, HERE] : [item],
);

export function MobileHeader() {
  const { t } = useLang();
  const reduced = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const menuRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  const lenis = useLenis((l) => {
    setScrolled(l.scroll > 32);
  });

  /* Nothing behind the panel moves while it is open, and Escape always closes
     it. The lock is `overflow: hidden` on the document rather than a fixed
     body, so the page is exactly where it was left when the panel goes. */
  useEffect(() => {
    if (!open) return;
    lenis?.stop();
    document.documentElement.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = "";
      lenis?.start();
    };
  }, [open, lenis]);

  /* Focus goes in with the panel and comes back out with it, so a keyboard
     never ends up somewhere behind a screen it cannot see. */
  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      closeRef.current?.focus({ preventScroll: true });
    } else if (wasOpen.current) {
      wasOpen.current = false;
      menuRef.current?.focus({ preventScroll: true });
    }
  }, [open]);

  /* Close first, then travel — the scroll runs against an unlocked page. */
  const goTo = (hash: string) => {
    setOpen(false);
    window.setTimeout(() => lenis?.scrollTo(hash, { duration: 1.4 }), 140);
  };

  const toTop = (e: React.MouseEvent) => {
    e.preventDefault();
    setOpen(false);
    window.setTimeout(() => lenis?.scrollTo(0, { duration: 1.4 }), 140);
  };

  const markLabel = `${site.tagline} ${site.name}, ${site.town} — ${t("common.toTop")}`;

  return (
    <header className="md:hidden">
      {/* The card, closed. The entrance blur lives on this wrapper and not on
          anything containing the panel: a filter becomes the containing block
          for fixed descendants, and would pin the panel to this height. */}
      <motion.div
        initial={reduced ? false : { opacity: 0, y: -14, filter: "blur(14px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{
          duration: reduced ? 0 : 1.4,
          delay: reduced ? 0 : 0.35,
          ease: EASE,
        }}
        className={`fixed ${EDGE} top-3 z-50`}
      >
        <motion.div
          animate={{ opacity: open ? 0 : 1 }}
          transition={{ duration: reduced ? 0 : 0.3, ease: EASE }}
          className={open ? "pointer-events-none" : undefined}
        >
          <div
            className={`${HEAD} ${CORNER} border text-night-ink shadow-[0_18px_44px_-26px_rgba(0,0,0,0.95)] backdrop-blur-xl transition-colors duration-700 ${
              scrolled
                ? "border-gold/25 bg-night/80"
                : "border-gold/15 bg-night/55"
            }`}
          >
            <a
              href="#main"
              onClick={toTop}
              aria-label={markLabel}
              className="shrink-0 transition-colors duration-500 active:text-gold"
            >
              <Lockup size="xs" tone="light" />
            </a>

            <button
              ref={menuRef}
              type="button"
              onClick={() => setOpen(true)}
              aria-expanded={open}
              aria-controls={PANEL_ID}
              className={`${CONTROL} ${CONTROL_MENU}`}
            >
              {t("common.menu")}
            </button>
          </div>
        </motion.div>
      </motion.div>

      {/* The same card, opened. It unrolls from its own top edge — no scaling,
          nothing springs — and the head it opens with is the head it closed
          with, in the same place. */}
      <AnimatePresence>
        {open && (
          <motion.div
            id={PANEL_ID}
            role="dialog"
            aria-modal="true"
            aria-label={t("common.menu")}
            initial={
              reduced
                ? { opacity: 0 }
                : { opacity: 1, clipPath: "inset(0% 0% 100% 0%)" }
            }
            animate={
              reduced
                ? { opacity: 1 }
                : { opacity: 1, clipPath: "inset(0% 0% 0% 0%)" }
            }
            exit={
              reduced
                ? { opacity: 0 }
                : { opacity: 1, clipPath: "inset(0% 0% 100% 0%)" }
            }
            transition={{ duration: reduced ? 0 : 0.6, ease: EASE }}
            className={`fixed ${EDGE} inset-y-3 z-50 flex flex-col overflow-hidden ${CORNER} border border-gold/18 bg-night/95 text-night-ink shadow-[0_40px_90px_-30px_rgba(0,0,0,0.95)] backdrop-blur-2xl`}
          >
            {/* one lamp in the far corner, and a little haze under it */}
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "radial-gradient(80% 45% at 100% 0%, rgba(122,72,180,0.32), transparent 70%), radial-gradient(70% 40% at 0% 100%, rgba(200,164,93,0.10), transparent 72%)",
              }}
              aria-hidden="true"
            />

            <div className={`${HEAD} relative`}>
              <a
                href="#main"
                onClick={toTop}
                aria-label={markLabel}
                className="shrink-0 transition-colors duration-500 active:text-gold"
              >
                <Lockup size="xs" tone="light" />
              </a>

              <button
                ref={closeRef}
                type="button"
                onClick={() => setOpen(false)}
                className={`${CONTROL} ${CONTROL_CLOSE}`}
              >
                {t("common.close")}
              </button>
            </div>

            {/* The nights sit centred, but centred a little above the middle:
                dead centre in a full-height panel leaves a hole under the head
                that reads as something missing. The bottom padding is what
                lifts them, so the group stays balanced at any phone height. */}
            <nav
              aria-label="Plitvice"
              className="relative flex-1 overflow-y-auto overscroll-contain px-6 pb-[9vh] pt-4"
            >
              <ul className="flex min-h-full flex-col items-center justify-center gap-8 text-center">
                {doors.map((item, i) => {
                  const inner = (
                    <Item label={t(item.label)} reserve={item.href === site.reservePath} />
                  );

                  return (
                    <motion.li
                      key={item.href}
                      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      /* Out together and quickly — the stagger is an arrival,
                         and repeating it on the way out only makes the panel
                         wait for its own children before it can close. */
                      exit={{
                        opacity: 0,
                        transition: { duration: reduced ? 0 : 0.18, ease: EASE },
                      }}
                      transition={{
                        duration: reduced ? 0 : 0.55,
                        delay: reduced ? 0 : 0.2 + i * 0.055,
                        ease: EASE,
                      }}
                    >
                      {/* "#" entries travel down the page; the rest are real
                          destinations and stay real links. */}
                      {item.href.startsWith("#") ? (
                        <a
                          href={item.href}
                          onClick={(e) => {
                            e.preventDefault();
                            goTo(item.href);
                          }}
                          className="group inline-flex items-center gap-4"
                        >
                          {inner}
                        </a>
                      ) : (
                        <Link
                          href={item.href}
                          onClick={() => setOpen(false)}
                          className="group inline-flex items-center gap-4"
                        >
                          {inner}
                        </Link>
                      )}
                    </motion.li>
                  );
                })}
              </ul>
            </nav>

            <motion.div
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{
                opacity: 0,
                transition: { duration: reduced ? 0 : 0.18, ease: EASE },
              }}
              transition={{
                duration: reduced ? 0 : 0.6,
                delay: reduced ? 0 : 0.45,
                ease: EASE,
              }}
              className="relative flex shrink-0 items-center justify-between gap-4 border-t border-line px-5 pb-7 pt-5"
            >
              <SocialLinks tone="night" />
              <LanguageSwitcher tone="night" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

/* Every night is set the same way but one. The reservation keeps the gold, a
   hairline under the word and the house arrow after it — the strongest line in
   the menu without becoming a button parked in the middle of it. */
function Item({ label, reserve }: { label: string; reserve: boolean }) {
  if (!reserve) {
    return (
      <span
        className={`${LINK} text-night-ink/90 transition-colors duration-500 group-hover:text-gold-light group-active:text-gold-light`}
      >
        {label}
      </span>
    );
  }

  return (
    <>
      <span
        className={`${LINK} border-b border-gold/40 pb-2 text-gold-light transition-colors duration-500 group-hover:border-gold group-active:border-gold`}
      >
        {label}
      </span>
      <Arrow className="w-7 text-gold group-hover:w-10" />
    </>
  );
}
