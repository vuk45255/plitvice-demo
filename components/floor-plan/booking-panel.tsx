"use client";

import { useId } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Arrow } from "@/components/arrow";
import { EASE } from "@/components/reveal";
import { Field, NoteField } from "@/components/reservation/field";
import { GuestCounter } from "@/components/floor-plan/guest-counter";
import { HoldCountdown } from "@/components/floor-plan/hold-countdown";
import { useSeatCopy } from "@/components/floor-plan/use-seat-copy";
import { useLang } from "@/components/providers/language";
import { site } from "@/lib/site";
import type { TableBooking } from "@/components/reservation/use-table-booking";

/* The card that opens on the floor.
 *
 * ONE CARD, THREE STATES, AND THE ROOM NEVER CLOSES. A guest touches a table
 * and it tells them what it is; they say how many are coming and choose it;
 * the same card becomes the reservation and then the confirmation. The map
 * stays exactly where it was underneath the whole time, with their table lit,
 * because the one question a booking screen has to keep answering is "which
 * table am I actually taking" — and the answer is on the drawing behind, not
 * in a sentence.
 *
 * It states what it knows and invents nothing: there is no price on it, no
 * deposit and no minimum spend, because the club has given us none.
 *
 * WHERE IT SITS. Down the left of the map on a desk, clear of the room; up
 * from the bottom edge on a phone, over the foot of the map and never over the
 * whole of it. Both are the same component and the same three states — the
 * difference is where it is anchored and how far it is allowed to grow, which
 * is the only thing about a phone that is genuinely different here. */

function Rail({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[0.625rem] uppercase tracking-[0.3em] text-night-ink/45">
      {children}
    </p>
  );
}

function Hairline() {
  return (
    <div
      className="my-4 h-px bg-line [@media(max-height:700px)]:my-3 md:my-7"
      aria-hidden="true"
    />
  );
}

/* TWO CLOSES, AND THEY ARE NOT THE SAME ACTION.
 *
 * The cross inside this card puts the card away: the table is let go of, the
 * light goes off it, and the guest is left standing in the room exactly where
 * they were, at the same magnification, free to touch another table. It is the
 * opposite of a way out — it is a way back to browsing.
 *
 * The ZATVORI at the top of the screen is the way out, and it is the only one.
 * The two were once the same handler, which meant a guest dismissing a table
 * was thrown out of the club. */
export function BookingPanel({
  booking,
  onDismiss,
  onClose,
}: {
  booking: TableBooking;
  /* Put this card away and stay on the floor. */
  onDismiss: () => void;
  /* Leave the floor plan altogether. */
  onClose: () => void;
}) {
  const { t } = useLang();
  const reduced = useReducedMotion();
  const uid = useId();
  const { heading, zoneLabel, capacity, guestCount, statusLabel, chooseLabel } =
    useSeatCopy();

  const { seat, guests, step, event, problem } = booking;
  if (!seat) return null;

  /* Gone for good, or somebody else's three minutes. Neither can be chosen,
     and the card says which it is one line down. */
  const taken = seat.status === "reserved" || seat.status === "held";

  /* THE THREE MINUTES RAN OUT. It is its own whole state — the form is put
     away, the submit with it, and the guest is sent back to the floor — and
     it is reached either by the countdown reaching zero or by the server
     saying so, whichever gets there first. See use-seat-hold.ts. */
  const expired = problem === "hold-expired" || (step === "details" && booking.holdExpired);

  /* Two of the house's answers are whole states of their own — somebody else
     is holding that table, or this guest is already holding one for the night.
     Neither is a mistake in the form, so neither is shown as one. The rest are
     a single line above the button and the form stays exactly as it was, with
     everything they typed still in it. */
  const blocked = problem === "duplicate" || problem === "seat-taken";
  const trouble =
    problem === "busy"
      ? t("floor.err.busy")
      : problem === "unavailable"
        ? t("floor.err.unavailable")
        : problem === "seat-held"
          ? t("floor.err.held")
          : problem === "failed"
            ? t("floor.err.failed")
            : null;

  /* The cross the two working steps carry. It dismisses the card and nothing
     else — see the note above the component. */
  const dismiss = (
    <button
      type="button"
      onClick={onDismiss}
      aria-label={t("floor.dismiss")}
      className="-mr-2 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center text-night-ink/45 transition-colors duration-500 hover:text-gold-light"
    >
      <span className="relative block h-4 w-4" aria-hidden="true">
        <span className="absolute left-0 top-1/2 h-px w-4 rotate-45 bg-current" />
        <span className="absolute left-0 top-1/2 h-px w-4 -rotate-45 bg-current" />
      </span>
    </button>
  );

  /* ── the table, and how many are coming ───────────────────────────────── */
  const tableStep = (
    <div>
      <div className="flex items-start justify-between gap-5">
        <div className="min-w-0">
          <h3 className="font-serif text-[clamp(1.5rem,4vw,1.875rem)] uppercase leading-none tracking-[0.04em] text-gold-light">
            {heading(seat)}
          </h3>
          <div className="mt-4 space-y-2">
            <Rail>{zoneLabel(seat)}</Rail>
            <p className="text-[0.8125rem] tabular-nums text-night-ink/70">
              {capacity(seat)}
            </p>
            <p className="text-[0.6875rem] tabular-nums text-night-ink/35">
              {t("floor.min")} {seat.capacity.min}
              <span className="mx-2 text-night-ink/15" aria-hidden="true">
                ·
              </span>
              {t("floor.max")} {seat.capacity.max}
            </p>
          </div>
        </div>
        {dismiss}
      </div>

      <p
        className={`mt-6 text-[0.625rem] uppercase tracking-[0.3em] ${
          taken ? "text-night-ink/35" : "text-gold-light"
        }`}
      >
        {statusLabel(seat)}
      </p>

      {taken ? null : (
        <>
          <Hairline />
          <GuestCounter
            value={guests}
            min={seat.capacity.min}
            max={seat.capacity.max}
            onChange={booking.setParty}
          />
          {/* Choosing the table is now a word with the house rather than a
              step in the page: it goes and holds it, and the form opens only
              once that has been granted. Almost always instantaneous, and the
              label changes rather than a spinner appearing. */}
          <button
            type="button"
            onClick={() => void booking.confirmSeat()}
            disabled={booking.taking}
            className="btn-gold btn-gold-night mt-8 w-full text-center disabled:cursor-wait disabled:opacity-60"
          >
            <span className="inline-flex items-center justify-center gap-4">
              {booking.taking ? t("floor.hold.taking") : chooseLabel(seat)}
              {booking.taking ? null : <Arrow className="w-6" />}
            </span>
          </button>

          {/* Somebody beat them to it by a second, or the house could not be
              reached. Said here, on the card, with the map still in front of
              them — which is a far better place to find out than the bottom of
              a filled-in form. */}
          <div aria-live="polite">
            <AnimatePresence>
              {trouble ? (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: reduced ? 0 : 0.4 }}
                  className="mt-4 text-[0.6875rem] leading-[1.5] tracking-[0.08em] text-[#e6a091]"
                >
                  {trouble}
                </motion.p>
              ) : null}
            </AnimatePresence>
          </div>
        </>
      )}
    </div>
  );

  /* ── who is coming ────────────────────────────────────────────────────── */
  const detailsStep = (
    <form
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        const first = await booking.submit();
        if (first) document.getElementById(`${uid}-${first}`)?.focus();
      }}
    >
      {/* The table is theirs while they fill this in, and this is the only
          place that says so. It is stuck to the top of the card's own scroll,
          so on a phone with the keyboard up it stays above the fields instead
          of scrolling away — and it is inside the card, so it can never cover
          the map, the header or the button at the foot of the form. */}
      {booking.hold ? (
        <HoldCountdown
          seat={seat}
          seconds={booking.holdSeconds}
          totalSeconds={booking.hold.totalSeconds}
        />
      ) : null}

      <div className="flex items-start justify-between gap-5">
        <button
          type="button"
          onClick={booking.backToTable}
          className="group -ml-1 flex items-center gap-3 py-1 text-[0.5625rem] uppercase tracking-[0.26em] text-night-ink/45 transition-colors duration-500 hover:text-gold-light"
        >
          <span
            className="relative block h-px w-6 bg-current transition-[width] duration-500 group-hover:w-8"
            aria-hidden="true"
          >
            <svg
              viewBox="0 0 8 8"
              className="absolute -left-px -top-[3.5px] h-[7px] w-[7px] overflow-visible"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            >
              <path d="M4 0.5 L0.5 4 L4 7.5" />
            </svg>
          </span>
          {t("floor.back")}
        </button>
        {dismiss}
      </div>

      <div className="mt-4 [@media(max-height:700px)]:mt-3 md:mt-6">
        <Rail>{t("floor.booking")}</Rail>
        <p className="mt-2 text-[0.6875rem] uppercase tracking-[0.24em] text-gold/80 md:mt-3">
          {event.artist}
          <span className="mx-2 text-gold/30" aria-hidden="true">
            ·
          </span>
          {t(event.date)}
        </p>
        <h3 className="mt-3 font-serif text-[clamp(1.375rem,3.5vw,1.75rem)] uppercase leading-none tracking-[0.04em] text-gold-light [@media(max-height:700px)]:mt-2 md:mt-5">
          {heading(seat)}
        </h3>
        <p className="mt-2 text-[0.625rem] uppercase tracking-[0.28em] text-night-ink/45 md:mt-3">
          {zoneLabel(seat)}
          <span className="mx-2 text-night-ink/20" aria-hidden="true">
            ·
          </span>
          <span className="tabular-nums">{guestCount(guests)}</span>
        </p>
      </div>

      <Hairline />

      <div className="space-y-3.5 [@media(max-height:700px)]:space-y-2.5 [@media(min-height:740px)]:space-y-5 md:space-y-7">
        <Field
          compact
          id={`${uid}-name`}
          name="name"
          label={t("reserve.name")}
          type="text"
          autoComplete="name"
          value={booking.values.name}
          error={booking.errors.name}
          onChange={booking.set("name")}
          onBlur={booking.blur("name")}
        />
        <Field
          compact
          id={`${uid}-phone`}
          name="phone"
          label={t("reserve.phone")}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={booking.values.phone}
          error={booking.errors.phone}
          onChange={booking.set("phone")}
          onBlur={booking.blur("phone")}
        />
        <Field
          compact
          id={`${uid}-email`}
          name="email"
          /* Required now, and it says so by saying nothing: the word that used
             to follow it was the only thing marking it optional. */
          label={t("reserve.email")}
          type="email"
          inputMode="email"
          autoComplete="email"
          spellCheck={false}
          value={booking.values.email}
          error={booking.errors.email}
          onChange={booking.set("email")}
          onBlur={booking.blur("email")}
        />
        <NoteField
          compact
          id={`${uid}-note`}
          value={booking.values.note}
          onChange={booking.set("note")}
        />
      </div>

      {/* One quiet line rather than a stack of red — the fields carry their
          own messages. */}
      {/* One quiet line, and only when there is something to say. */}
      <div aria-live="polite">
        <AnimatePresence>
          {booking.invalid || trouble ? (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduced ? 0 : 0.4 }}
              className="mt-4 text-[0.6875rem] uppercase tracking-[0.24em] text-[#e6a091] md:mt-6"
            >
              {trouble ?? t("reserve.err.summary")}
            </motion.p>
          ) : null}
        </AnimatePresence>
      </div>

      <button
        type="submit"
        disabled={booking.sending}
        className="btn-gold btn-gold-night mt-4 w-full text-center disabled:cursor-wait disabled:opacity-60 [@media(min-height:740px)]:mt-6 md:mt-7"
      >
        <span className="inline-flex items-center justify-center gap-4">
          {booking.sending ? t("reserve.sending") : t("reserve.submit")}
          {booking.sending ? null : <Arrow className="w-6" />}
        </span>
      </button>

      {/* Reassurance, not instruction — the first thing to go when the screen
          is short, and back the moment there is room for it. */}
      <p className="mt-4 hidden text-[0.75rem] leading-relaxed text-night-ink/35 [@media(min-height:800px)]:block md:mt-5 md:block">
        {t("reserve.footnote")}
      </p>
    </form>
  );

  /* ── the three minutes ran out ────────────────────────────────────────── */
  /* Nothing was lost that was theirs to lose: the table was never booked, it
     is simply back on the floor for everybody. So this is stated plainly and
     without apology, and the way on is one button back to the map — where they
     may well find the same table still free and take it again.
     What they typed is deliberately kept. Pressing the button below returns
     them to the floor with the name, the telephone and the note still in the
     form, so choosing another table costs them the choice and not the typing. */
  const expiredStep = (
    <div role="status" aria-live="polite">
      <div className="flex items-start justify-between gap-5">
        <span
          className="mt-2 block h-px w-20 bg-gradient-to-r from-[#e6a091] to-transparent"
          aria-hidden="true"
        />
        {dismiss}
      </div>

      <h3 className="mt-5 font-serif text-[clamp(1.25rem,3.5vw,1.5rem)] uppercase leading-tight tracking-[0.04em] text-night-ink md:mt-7">
        {t("floor.hold.expiredTitle")}
      </h3>
      <p className="mt-3 text-[0.875rem] leading-relaxed text-night-ink/60 md:mt-4">
        {t(
          seat.type === "booth"
            ? "floor.hold.expiredBodyBooth"
            : "floor.hold.expiredBody",
        )}
      </p>

      <button
        type="button"
        onClick={booking.chooseAgain}
        className="btn-gold btn-gold-night mt-7 w-full text-center"
      >
        <span className="inline-flex items-center justify-center gap-4">
          {t(seat.type === "booth" ? "floor.hold.againBooth" : "floor.hold.again")}
          <Arrow className="w-6" />
        </span>
      </button>
    </div>
  );

  /* ── it has gone ──────────────────────────────────────────────────────── */
  /* Held by somebody — or by this guest already.
   *
   * The reservation is not lost and nothing is said about why the house knows:
   * a guest is told they already have a table for this night and how to change
   * it, or that this one went while they were typing, and in both cases the
   * way on is the same — back to the floor, where they can see what is left. */
  const blockedStep = (
    <div role="status" aria-live="polite">
      <div className="flex items-start justify-between gap-5">
        <span
          className="mt-2 block h-px w-20 bg-gradient-to-r from-gold to-transparent"
          aria-hidden="true"
        />
        {dismiss}
      </div>

      <h3 className="mt-5 font-serif text-[clamp(1.25rem,3.5vw,1.5rem)] uppercase leading-tight tracking-[0.04em] text-gold-light md:mt-7">
        {t(problem === "duplicate" ? "floor.dup.title" : "floor.gone.title")}
      </h3>
      <p className="mt-3 text-[0.875rem] leading-relaxed text-night-ink/60 md:mt-4">
        {t(problem === "duplicate" ? "floor.dup.body" : "floor.gone.body")}
      </p>

      {problem === "duplicate" ? (
        <p className="mt-4 text-[0.8125rem] leading-relaxed text-night-ink/45">
          {t("floor.dup.help")}{" "}
          <a
            href={`tel:${site.phone.replace(/\s/g, "")}`}
            className="whitespace-nowrap tabular-nums text-gold transition-colors duration-500 hover:text-gold-light"
          >
            {site.phone}
          </a>
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => {
          booking.clearProblem();
          onDismiss();
        }}
        className="btn-gold btn-gold-night mt-7 w-full text-center"
      >
        <span className="inline-flex items-center justify-center gap-4">
          {t(problem === "duplicate" ? "floor.dup.back" : "floor.gone.back")}
          <Arrow className="w-6" />
        </span>
      </button>
    </div>
  );

  /* The one card whose cross does leave: the reservation has gone, there is
     nothing left on the floor to come back to, and the button below it says
     the same thing in words. */
  const sentStep = (
    <div role="status" aria-live="polite">
      <div className="flex items-start justify-between gap-5">
        <span
          className="mt-2 block h-px w-20 bg-gradient-to-r from-gold to-transparent"
          aria-hidden="true"
        />
        <button
          type="button"
          onClick={onClose}
          aria-label={t("reserve.close")}
          className="-mr-2 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center text-night-ink/45 transition-colors duration-500 hover:text-gold-light"
        >
          <span className="relative block h-4 w-4" aria-hidden="true">
            <span className="absolute left-0 top-1/2 h-px w-4 rotate-45 bg-current" />
            <span className="absolute left-0 top-1/2 h-px w-4 -rotate-45 bg-current" />
          </span>
        </button>
      </div>
      <p className="mt-7 font-serif text-[clamp(1.375rem,3.5vw,1.75rem)] leading-[1.2] text-night-ink">
        {t("reserve.successTitle")}
      </p>
      <p className="mt-4 text-[0.875rem] leading-relaxed text-night-ink/55">
        {t("reserve.successBody")}
      </p>
      <Hairline />
      <p className="text-[0.625rem] uppercase tracking-[0.28em] text-gold/80">
        {event.artist}
        <span className="mx-2 text-gold/30" aria-hidden="true">
          ·
        </span>
        {t(event.date)}
      </p>
      <p className="mt-3 text-[0.625rem] uppercase tracking-[0.28em] text-night-ink/45">
        {heading(seat)}
        <span className="mx-2 text-night-ink/20" aria-hidden="true">
          ·
        </span>
        <span className="tabular-nums">{guestCount(guests)}</span>
      </p>
      <button
        type="button"
        onClick={onClose}
        className="btn-gold btn-gold-night mt-8 w-full text-center"
      >
        {t("reserve.close")}
      </button>
    </div>
  );

  /* A finished reservation outranks everything — the hold behind it is spent
     and its clock is irrelevant. After that, an expired hold outranks the form
     it was holding open. */
  const content =
    step === "sent"
      ? sentStep
      : expired
        ? expiredStep
        : blocked
          ? blockedStep
          : step === "table"
            ? tableStep
            : detailsStep;

  return (
    <motion.section
      key="panel"
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, y: 14 }}
      transition={{ duration: reduced ? 0 : 0.5, ease: EASE }}
      aria-label={heading(seat)}
      /* The form is taller than the card, so the panel scrolls rather than
         growing past the map. The bar is left thin and gold: a default
         Windows scrollbar down the side of this would be the loudest thing
         on the screen. */
      style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(200,164,93,0.35) transparent" }}
      /* AND THIS IS WHY THE SCROLL ABOVE ACTUALLY HAPPENS ON A PHONE.
       *
       * The card has had `overflow-y-auto` all along and it still would not
       * move under a thumb, because opening the room calls `lenis.stop()`
       * (floor-plan-overlay.tsx) and a stopped Lenis preventDefault()s every
       * touchmove on the document — the inner scroller included. A guest could
       * see POTVRDI below the fold and had no way to reach it.
       *
       * [data-lenis-prevent] is the escape Lenis itself provides: its
       * onVirtualScroll walks the composed path and returns before the
       * preventDefault when it finds this. The floor plan's own gestures are
       * untouched — pan and pinch live on the <svg>, which is a SIBLING of
       * this card and keeps its `touch-action: none`. So the map still pans
       * where the map is, and the form scrolls where the form is. */
      data-lenis-prevent
      /* HOW TALL THE SHEET IS ALLOWED TO BE, on a phone, as a share of the map
         it is standing on. Choosing a table needs two thirds and leaves the
         floor plainly in view; filling the booking in needs nearly all of it,
         because the whole form and the button under it have to be reachable
         without a scroll — but never quite all, so the room the table stands
         in is still there behind. Scrolling stays possible and is a fallback
         for a very short screen or an open keyboard, not the way this works. */
      className={`pointer-events-auto w-full overflow-y-auto overscroll-contain border-t border-gold/25 bg-night/95 px-6 pb-5 pt-4 backdrop-blur-xl md:w-[21.5rem] md:border md:px-8 md:pb-8 md:pt-7 [@media(min-height:740px)]:pb-7 [@media(min-height:740px)]:pt-6 ${
        step === "table"
          ? "max-h-[66%] [@media(max-height:700px)]:max-h-[72%]"
          : "max-h-[88%] [@media(max-height:700px)]:max-h-[95%]"
      } md:max-h-full`}
    >
      {/* the phone's grip: it says the sheet came from the bottom edge */}
      <span
        aria-hidden="true"
        className="mx-auto mb-3.5 block h-px w-10 bg-night-ink/20 [@media(min-height:740px)]:mb-5 md:hidden"
      />
      {/* One step at a time, and the change of key is what animates it: the new
          face is a new element, and it fades in on arrival.
          Deliberately not AnimatePresence with mode="wait". That mounts the
          next step only once the last one has finished bowing out, which makes
          the card's correctness depend on an animation completing — and an
          animation that never runs, in whatever environment that turns out to
          be, leaves the guest looking at the wrong step for ever while the
          state says otherwise. This cannot get stuck: the step is what is
          rendered, and the fade is decoration on top of it. */}
      <motion.div
        key={expired ? "expired" : blocked ? `${step}-${problem}` : step}
        initial={reduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduced ? 0 : 0.32, ease: EASE }}
      >
        {content}
      </motion.div>
    </motion.section>
  );
}
