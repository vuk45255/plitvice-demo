"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useLenis } from "lenis/react";
import { EASE } from "@/components/reveal";
import { useLang } from "@/components/providers/language";

/* THE ADMISSION NOTICE.
 *
 * The house rules a guest agrees to before they can buy anything: what to
 * bring to the door, and what the club does and does not refund. It is a gate,
 * not a page — the reservation room is already rendered and visible behind it,
 * darkened and pushed slightly out of focus, so a guest can see what they are
 * about to walk into while they read the conditions.
 *
 * IT FAILS CLOSED. The acknowledgement is kept in sessionStorage, so it is
 * asked once per visit and never again while the guest works through that same
 * session; a browser that refuses storage entirely gets the notice every time,
 * because showing a legal condition twice is a small annoyance and skipping it
 * is not.
 *
 * THERE IS NO WAY PAST IT. Deliberately: no cross, no Escape, no click on the
 * darkened page behind, no "later". The conditions are a condition of sale, so
 * the only thing that dismisses this panel is ticking the box and pressing the
 * button — every other gesture does nothing at all. A guest who does not want
 * to agree still has the browser's own back button and the address bar; what
 * they do not have is a way to arrive in the reservation without having
 * agreed. */

export const GATE_KEY = "plitvice-admission";

/* The acknowledgement is external state — it lives in sessionStorage, not in
   React — so it is subscribed to rather than copied into a hook from an
   effect. Reading it during render is also what keeps the notice from
   appearing for a frame and then vanishing for a guest who has already agreed.
   The server is told it has been acknowledged: the panel is a portal into
   document.body, so the server renders nothing for it either way. */
let watchers: (() => void)[] = [];

function watch(fn: () => void) {
  watchers.push(fn);
  return () => {
    watchers = watchers.filter((w) => w !== fn);
  };
}

function acknowledged() {
  try {
    return Boolean(window.sessionStorage.getItem(GATE_KEY));
  } catch {
    /* A browser that refuses storage is asked again — showing a condition
       twice is a small annoyance, skipping it is not. */
    return false;
  }
}

function acknowledge() {
  try {
    window.sessionStorage.setItem(GATE_KEY, "1");
  } catch {
    /* Nothing to remember it with; the notice simply returns next time. */
  }
  watchers.forEach((w) => w());
}

/* Everything the guest has to have read, in the order it matters at the door. */
const CONDITIONS = ["gate.p1", "gate.p2", "gate.p3", "gate.p4"] as const;

/* What the trap considers reachable. The button is excluded while it is still
   disabled, which is correct: until the box is ticked the box is the only stop
   in the cycle, and Tab simply returns to it. */
const FOCUSABLE =
  'button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

export function ReservationGate() {
  const { t } = useLang();
  const reduced = useReducedMotion();
  const lenis = useLenis();

  const done = useSyncExternalStore(watch, acknowledged, () => true);
  const [agreed, setAgreed] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const open = !done;

  /* The page underneath is held still while the notice has the screen — the
     same hold the floor plan and the phone's menu use. */
  useEffect(() => {
    if (!open) return;
    lenis?.stop();
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = "";
      lenis?.start();
    };
  }, [open, lenis]);

  /* Focus goes to the panel itself, so what a screen reader announces on
     arrival is the notice. */
  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  const accept = useCallback(() => {
    acknowledge();
  }, []);

  /* Tab, on the other hand, belongs to the panel: it cycles the stops inside
     and cannot get behind them. */
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key !== "Tab") return;

      const stops = panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (!stops || stops.length === 0) return;

      const first = stops[0];
      const last = stops[stops.length - 1];
      const here = document.activeElement;

      if (e.shiftKey && (here === first || here === panelRef.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && here === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [],
  );

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center overflow-hidden p-5 sm:p-6">
          {/* The room, still there and still legible — only put behind glass. */}
          <motion.div
            className="absolute inset-0 bg-night/75 backdrop-blur-[6px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.4, ease: EASE }}
            aria-hidden="true"
          />

          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="gate-title"
            tabIndex={-1}
            onKeyDown={onKeyDown}
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.985 }}
            transition={{ duration: reduced ? 0 : 0.45, ease: EASE }}
            className="relative flex max-h-[88svh] w-full max-w-[44rem] flex-col overflow-hidden rounded-[8px] border border-gold/25 bg-night-2/85 shadow-[0_30px_90px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl outline-none"
          >
            {/* the lamp in the far corner of the panel, not a gradient for its
                own sake */}
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "radial-gradient(120% 90% at 88% -10%, rgba(42,18,63,0.75), transparent 62%), radial-gradient(80% 60% at 0% 100%, rgba(200,164,93,0.07), transparent 70%)",
              }}
              aria-hidden="true"
            />

            <div className="relative flex items-start justify-between gap-5 px-6 pb-1 pt-7 md:px-9 md:pt-9">
              <div className="min-w-0">
                <p className="rail rail-night !text-[0.5625rem]">
                  {t("gate.label")}
                </p>
                <h2
                  id="gate-title"
                  className="mt-4 font-serif text-[clamp(1.375rem,5.2vw,1.9rem)] uppercase leading-[1.12] tracking-[0.005em] text-night-ink"
                >
                  {t("gate.title")}
                </h2>
              </div>
            </div>

            {/* The conditions. Given their own scroll so a small phone never
                pushes the button off the bottom of the screen. */}
            <div className="relative min-h-0 flex-1 overflow-y-auto px-6 py-6 md:px-9">
              <div className="space-y-4">
                {CONDITIONS.map((line) => (
                  <p
                    key={line}
                    className="text-[0.8125rem] leading-[1.75] text-night-ink/60 md:text-sm"
                  >
                    {t(line)}
                  </p>
                ))}
              </div>
            </div>

            <div className="relative border-t border-gold/15 px-6 pb-7 pt-6 md:px-9">
              <label className="flex cursor-pointer items-start gap-3.5">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="peer sr-only"
                />
                {/* The tick is driven from HERE, not from the svg itself:
                    `peer-*` compiles to a sibling combinator, and the svg is a
                    grandchild of the input's sibling rather than a sibling of
                    it, so a `peer-checked:` on the svg would never match. */}
                <span
                  aria-hidden="true"
                  className="mt-px flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[3px] border border-gold/35 bg-night/40 transition-[background-color,border-color] duration-300 [&>svg]:opacity-0 peer-checked:border-gold/80 peer-checked:bg-gold/20 peer-checked:[&>svg]:opacity-100 peer-focus-visible:ring-1 peer-focus-visible:ring-gold/70 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-night-2"
                >
                  <svg
                    viewBox="0 0 12 12"
                    fill="none"
                    className="h-3 w-3 transition-opacity duration-300"
                  >
                    <path
                      d="M2.5 6.4 4.8 8.7 9.5 3.6"
                      stroke="rgb(232 216 168)"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <span className="text-[0.8125rem] leading-[1.6] text-night-ink/70">
                  {t("gate.accept")}
                </span>
              </label>

              <button
                type="button"
                onClick={accept}
                disabled={!agreed}
                className={`mt-6 flex w-full items-center justify-center gap-3 rounded-[4px] border px-6 py-4 text-[0.6875rem] uppercase tracking-[0.28em] transition-[color,border-color,background-color,box-shadow] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                  agreed
                    ? "cursor-pointer border-gold/60 bg-violet/45 text-gold-light hover:border-gold/90 hover:bg-violet/65 hover:shadow-[0_0_34px_-12px_rgba(200,164,93,0.5)]"
                    : "cursor-not-allowed border-gold/15 bg-night/30 text-night-ink/25"
                }`}
              >
                {t("gate.continue")}
                <span aria-hidden="true">→</span>
              </button>
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
