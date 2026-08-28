"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useLenis } from "lenis/react";
import { EASE } from "@/components/reveal";
import { BookingPanel } from "@/components/floor-plan/booking-panel";
import { FloorPlan } from "@/components/floor-plan/floor-plan";
import { FloorPlanTooltip } from "@/components/floor-plan/floor-plan-tooltip";
import { INK } from "@/components/floor-plan/plan-ink";
import { useLang } from "@/components/providers/language";
import { SEAT_KINDS, type SeatType } from "@/lib/floor-plan";
import {
  applySnapshot,
  seatsForEvent,
  type FloorSnapshot,
  type Seat,
} from "@/lib/floor-availability";
import type { TableBooking } from "@/components/reservation/use-table-booking";

/* The room, opened over the page — and the whole booking, done inside it.
 *
 * THE GUEST IS NEVER SENT BACK. Once the map is open, everything that happens
 * to a reservation happens here: the table is touched, its card opens, the
 * party is counted, the table is taken, the house is told who is coming and
 * the thing is sent. There is no step that closes the room and drops them on a
 * form somewhere else, because a form somewhere else cannot show them the
 * table they are taking, and that is the only fact a guest is really trying to
 * hold on to.
 *
 * The plan is given the whole screen because it needs the whole screen: a club
 * this size laid into a column beside a form is a diagram, not a map. Taking
 * the viewport is also the one arrangement that is the same on a desk and on a
 * phone, so there is a single behaviour to reason about rather than two.
 *
 * Nothing is decided here either. The reservation lives above this component —
 * see use-table-booking — so a guest may open the room, look, touch a table,
 * change their mind, close it and come back to exactly where they were. */

/* The three things on the floor, with the mark each one is drawn as and what
   it holds. Read straight off SEAT_KINDS, so it can never come to disagree
   with the plan it is explaining. */
function Legend() {
  const { t } = useLang();

  const marks: Record<SeatType, string> = {
    bar: "rounded-full",
    high: "rounded-full",
    booth: "rounded-[1px]",
  };
  const shape: Record<SeatType, string> = {
    bar: "h-3 w-3",
    high: "h-1.5 w-4",
    booth: "h-2.5 w-4",
  };

  return (
    <ul className="flex flex-wrap items-center gap-x-6 gap-y-3">
      {(Object.keys(SEAT_KINDS) as SeatType[]).map((type) => {
        const kind = SEAT_KINDS[type];
        return (
          <li key={type} className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className={`block shrink-0 ${shape[type]} ${marks[type]}`}
              style={{
                border: `1.5px solid ${INK.seat}`,
                background: INK.seatFill,
              }}
            />
            <span className="text-[0.5625rem] uppercase tracking-[0.26em] text-night-ink/45">
              {t(kind.label)}
              <span className="mx-1.5 text-night-ink/20">·</span>
              <span className="tabular-nums text-night-ink/60">
                {kind.capacity.min}–{kind.capacity.max}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function FloorPlanOverlay({
  booking,
  onClose,
}: {
  booking: TableBooking;
  onClose: () => void;
}) {
  const { t } = useLang();
  const reduced = useReducedMotion();
  const lenis = useLenis();
  const closeRef = useRef<HTMLButtonElement>(null);

  const [tooltip, setTooltip] = useState<{ seat: Seat; x: number; y: number }>();

  /* ── THE ROOM AS IT IS THIS SECOND ──────────────────────────────────────
   *
   * The drawing is static and known at build time; what is NOT known is which
   * tables somebody else is in the middle of taking, and that changes while
   * the guest is looking at it. So the map is drawn from the plan and then
   * coloured from the server's own answer, which is asked for every few
   * seconds for as long as this room is open.
   *
   * EVERY FEW SECONDS, and deliberately not more. A table changing hands is a
   * once-a-minute event in a busy club, not a once-a-frame one, and the
   * difference between four seconds and four hundred milliseconds is invisible
   * to a guest and a hundredfold to the server. There is no realtime channel
   * on this site and this does not deserve one.
   *
   * IT STOPS WHEN NOBODY IS LOOKING. A backgrounded tab polls nothing, and
   * asks once immediately on coming back — which is also what re-syncs the
   * countdown after a phone has been in a pocket.
   *
   * The same answer carries this guest's own hold, which is how a countdown
   * survives a refresh: React state is gone, the httpOnly cookie is not, and
   * the server hands the remaining seconds straight back. */
  const [snapshot, setSnapshot] = useState<
    (FloorSnapshot & { serverNow?: string; holdExpiresAt?: string }) | undefined
  >();

  const slug = booking.event.slug;

  /* Read through a ref so the poll below is not torn down and restarted every
     time the booking changes underneath it. */
  const syncFloor = booking.syncFloor;
  const syncRef = useRef(syncFloor);
  useEffect(() => {
    syncRef.current = syncFloor;
  }, [syncFloor]);

  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const response = await fetch(
          `/api/reservations/availability?eventId=${encodeURIComponent(slug)}`,
          { signal, cache: "no-store" },
        );
        if (!response.ok) return;
        const body = (await response.json()) as
          | (FloorSnapshot & { ok: true; serverNow: string; holdExpiresAt?: string })
          | null;
        if (!body?.ok) return;

        setSnapshot(body);
        /* The authoritative word on this guest's own three minutes. */
        syncRef.current(body);
      } catch {
        /* A poll that does not arrive changes nothing: the floor stays as it
           was last drawn, and the next one is four seconds away. Nothing a
           guest does depends on it — the server refuses what it must refuse
           whatever this map happens to be showing. */
      }
    },
    [slug],
  );

  useEffect(() => {
    const controller = new AbortController();

    /* The opening read, scheduled rather than fired from the effect body: the
       floor must not sit four seconds behind the room when it first appears,
       and a poll is a subscription rather than something a render does. */
    const first = window.setTimeout(() => void refresh(controller.signal), 0);

    const poll = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void refresh(controller.signal);
    }, 4000);

    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh(controller.signal);
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearTimeout(first);
      window.clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
      controller.abort();
    };
  }, [refresh]);

  /* The plan, coloured by the answer. Geometry is never touched by this — see
     applySnapshot in lib/floor-availability.ts. */
  const seats = useMemo(
    () => applySnapshot(seatsForEvent(slug), snapshot),
    [slug, snapshot],
  );

  const { seat, step } = booking;

  /* The page underneath is held still while the map has the screen — the same
     hold the header's menu uses. */
  useEffect(() => {
    lenis?.stop();
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = "";
      lenis?.start();
    };
  }, [lenis]);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      /* Escape backs out one layer at a time, in the order the guest walked
         in: the form first, then the card, then the room. A reservation that
         has already gone has nothing left to back out of. */
      if (step === "details") booking.backToTable();
      else if (seat && step === "table") booking.dismiss();
      else onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [booking, onClose, seat, step]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduced ? 0 : 0.45, ease: EASE }}
      className="fixed inset-0 z-[70] flex flex-col bg-night text-night-ink"
      role="dialog"
      aria-modal="true"
      aria-label={t("floor.title")}
    >
      {/* the way out, and what the guest is looking at. The legend is a desk
          luxury: a phone needs the floor more than it needs the key to it. */}
      <div className="flex shrink-0 items-start justify-between gap-6 px-5 pb-3 pt-5 md:px-10 md:pb-6 md:pt-9">
        <div>
          <p className="rail rail-night">{t("floor.pick")}</p>
          <div className="mt-4 hidden md:block">
            <Legend />
          </div>
        </div>

        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className="group -mr-2 flex shrink-0 items-center gap-3 px-2 py-2 text-[0.625rem] uppercase tracking-[0.3em] text-night-ink/60 transition-colors duration-500 hover:text-gold-light"
        >
          {t("reserve.close")}
          <span className="relative block h-4 w-4" aria-hidden="true">
            <span className="absolute left-0 top-1/2 h-px w-4 rotate-45 bg-current" />
            <span className="absolute left-0 top-1/2 h-px w-4 -rotate-45 bg-current" />
          </span>
        </button>
      </div>

      {/* the room takes everything that is left */}
      <div className="relative min-h-0 flex-1">
        <FloorPlan
          seats={seats}
          selectedId={seat?.id}
          onSelect={(chosen) => {
            booking.inspect(chosen);
            setTooltip(undefined);
          }}
          onHoverChange={(hovered, at) =>
            setTooltip(hovered && at ? { seat: hovered, x: at.clientX, y: at.clientY } : undefined)
          }
        />

        {/* The card: up from the bottom edge on a phone, down the left of the
            room on a desk. It never spans the map on either — the table being
            booked has to stay in sight. */}
        <div className="pointer-events-none absolute inset-0 z-20 flex items-end justify-center md:items-center md:justify-start md:p-8">
          <AnimatePresence>
            {seat ? (
              <BookingPanel
                booking={booking}
                /* The card's own cross: let the table go, stay in the room. */
                onDismiss={booking.dismiss}
                /* The way out, which only the header and the finished
                   reservation offer. */
                onClose={onClose}
              />
            ) : null}
          </AnimatePresence>
        </div>

        {/* how to move, for a thumb */}
        {seat ? null : (
          <p className="pointer-events-none absolute inset-x-0 bottom-5 z-10 text-center text-[0.5625rem] uppercase tracking-[0.28em] text-night-ink/30 md:hidden">
            {t("floor.hint")}
          </p>
        )}
      </div>

      {tooltip ? (
        <div className="hidden md:block">
          <FloorPlanTooltip seat={tooltip.seat} x={tooltip.x} y={tooltip.y} />
        </div>
      ) : null}
    </motion.div>,
    document.body,
  );
}
