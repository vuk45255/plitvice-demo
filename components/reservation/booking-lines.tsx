"use client";

import { useCallback, useId, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useLenis } from "lenis/react";
import { Arrow } from "@/components/arrow";
import { EASE } from "@/components/reveal";
import { TicketStep } from "@/components/reservation/ticket-step";
import { TableStep } from "@/components/reservation/table-step";
import { useLang } from "@/components/providers/language";
import { formatPrice } from "@/lib/booking";
import {
  entryPrice,
  ticketAvailability,
  type PartyEvent,
  type ReserveChoice,
} from "@/lib/events";
import { shrinkAbove, topOf, travelTo } from "@/lib/scroll";

/* The two ways into a night, set as a bill rather than as two cards.
 *
 * Each line is a rule, a name, one sentence of what it is, and the call. Open
 * one and it itemises in place — the other stays where it is, so the guest can
 * see both the whole time and never loses the night they picked.
 *
 * Opening a line also travels to it, and always to the same place: the line's
 * own name at the top of the screen, with the panel running down from under it.
 * Both of these are long — a form on a phone is several screens of it — so
 * without that the guest is left wherever the call happened to be, which is
 * usually somewhere in the middle of what just opened. */

export function BookingLines({
  event,
  open,
  onOpen,
}: {
  event: PartyEvent;
  open?: ReserveChoice;
  onOpen: (choice: ReserveChoice | undefined) => void;
}) {
  const { t, lang } = useLang();
  const uid = useId();
  const lenis = useLenis();
  const reduced = useReducedMotion();
  const lines = useRef<Partial<Record<ReserveChoice, HTMLDivElement | null>>>({});

  const price = entryPrice(event);
  const priceLabel = price === undefined ? undefined : formatPrice(price, lang);
  /* Whether this night is sold online is the night's own to say — lib/events
     answers it, and this file only draws the answer. A night with nothing
     priced has no ticket line at all, the same way a night that takes no
     tables has no table line; a night the club sells at the door keeps its
     line and wears it dimmed. */
  const tickets = ticketAvailability(event);

  /* Closing a line stays where it is — the guest is looking at the line they
     just closed and the page should not move under them. Opening one measures
     first and moves after, so the figure it travels to is the one the layout
     will have settled at rather than the one it is leaving. */
  const toggle = useCallback(
    (choice: ReserveChoice) => () => {
      if (open === choice) {
        onOpen(undefined);
        return;
      }

      const node = lines.current[choice];
      const target = node
        ? topOf(node) -
          shrinkAbove(open ? document.getElementById(`${uid}-${open}`) : null, node)
        : undefined;

      onOpen(choice);
      if (target !== undefined) travelTo(target, lenis, Boolean(reduced));
    },
    [lenis, onOpen, open, reduced, uid],
  );

  return (
    <div>
      {tickets === "open" ? (
        <Line
          id={`${uid}-karte`}
          nodeRef={(node) => {
            lines.current.karte = node;
          }}
          name={t("reserve.tickets")}
          price={priceLabel}
          lead={t("reserve.ticketsLead")}
          cta={t("events.buy")}
          open={open === "karte"}
          onToggle={toggle("karte")}
        >
          <TicketStep event={event} />
        </Line>
      ) : tickets === "unavailable" ? (
        <UnavailableLine
          name={t("reserve.tickets")}
          price={priceLabel}
          lead={t("reserve.ticketsLead")}
        />
      ) : null}

      {event.tables.enabled ? (
        <Line
          id={`${uid}-stolovi`}
          nodeRef={(node) => {
            lines.current.stolovi = node;
          }}
          name={t("reserve.tables")}
          lead={t("reserve.tablesLead")}
          cta={t("reserve.tablesCta")}
          open={open === "stolovi"}
          onToggle={toggle("stolovi")}
        >
          <TableStep event={event} />
        </Line>
      ) : null}

      {/* the bill closes with a rule, the way it opened */}
      <div className="border-t border-line" aria-hidden="true" />
    </div>
  );
}

function Line({
  id,
  nodeRef,
  name,
  price,
  lead,
  cta,
  open,
  onToggle,
  children,
}: {
  id: string;
  /* Handed up so the bill above can travel to this line's own top edge. */
  nodeRef: (node: HTMLDivElement | null) => void;
  name: string;
  /* Already formatted for the reader, or absent when the night has no price. */
  price?: string;
  lead: string;
  cta: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const { t } = useLang();
  const reduced = useReducedMotion();

  return (
    <div
      ref={nodeRef}
      className={`border-t transition-colors duration-700 ${
        open ? "border-gold/50" : "border-line"
      }`}
    >
      <h3>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={id}
          className="group relative flex w-full flex-col items-start gap-7 py-9 text-left sm:flex-row sm:items-center sm:justify-between sm:gap-10 md:gap-12 md:py-11"
        >
          {/* the lamp that comes up along the line as you reach for it */}
          <span
            className="pointer-events-none absolute -inset-x-4 inset-y-0 opacity-0 transition-opacity duration-700 group-hover:opacity-100"
            style={{
              background:
                "radial-gradient(45% 100% at 0% 50%, rgba(200,164,93,0.12), transparent 72%)",
            }}
            aria-hidden="true"
          />

          <LineName
            name={name}
            price={price}
            lead={lead}
            nameClass={
              open ? "text-gold-light" : "text-night-ink group-hover:text-gold-light"
            }
          />

          <span className="relative flex shrink-0 items-center gap-4 text-[0.6875rem] uppercase tracking-[0.28em] text-gold transition-colors duration-500 group-hover:text-gold-light">
            {open ? t("reserve.close") : cta}
            <Arrow className="w-8 group-hover:w-12" />
          </span>
        </button>
      </h3>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            id={id}
            key="panel"
            initial={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={reduced ? { opacity: 1 } : { height: "auto", opacity: 1 }}
            exit={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{
              height: { duration: reduced ? 0 : 0.75, ease: EASE },
              opacity: { duration: reduced ? 0 : 0.5, ease: EASE },
            }}
            className="overflow-hidden"
          >
            {children}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/* The left of a line: the name, what it costs, and one sentence of what it is.
   Set identically whether the line opens or is only there to be read — the
   caller passes the name's colour and, when the line is inert, the veil it
   sits behind. */
function LineName({
  name,
  price,
  lead,
  nameClass,
  className = "",
}: {
  name: string;
  price?: string;
  lead: string;
  nameClass: string;
  className?: string;
}) {
  return (
    <span className={`relative block min-w-0 ${className}`}>
      <span
        className={`block font-serif text-[clamp(1.625rem,3.4vw,2.5rem)] uppercase leading-none tracking-[0.05em] transition-colors duration-500 ${nameClass}`}
      >
        {name}
      </span>
      {price ? (
        <span className="mt-5 block text-[0.9375rem] uppercase tracking-[0.22em] tabular-nums text-gold-light/90">
          {price}
        </span>
      ) : null}
      <span
        className={`block max-w-[24rem] text-[0.875rem] leading-relaxed text-night-ink/50 ${
          price ? "mt-3" : "mt-4"
        }`}
      >
        {lead}
      </span>
    </span>
  );
}

/* A line the guest can read but not open — the night's tickets, for a night
   the club is not selling online.
 *
 * There is no button here at all: nothing to click, nothing to tab to, nothing
 * to press. The line keeps its place on the bill and its own type, dropped back
 * behind a veil and stripped of the gold — the lamp, the arrow and the call are
 * the interactive line's, not this one's.
 *
 * The notice sits under the line rather than opposite it, on the rule-and-rail
 * the rest of the house uses for a caption. Held out at the right the way a
 * call is, two lines of it would crowd the name off a narrow column; under it
 * there is room to read at any width, and it stays out in front of the veil,
 * because the reason is the part that has to carry. */
function UnavailableLine({
  name,
  price,
  lead,
}: {
  name: string;
  price?: string;
  lead: string;
}) {
  const { t } = useLang();

  return (
    <div className="border-t border-line/50">
      <div className="cursor-not-allowed select-none py-9 md:py-11">
        {/* Heading, the same as the line above it — the bill reads as two
            named lines whether or not both of them open. */}
        <h3>
          <LineName
            name={name}
            price={price}
            lead={lead}
            nameClass="text-night-ink"
            className="opacity-40"
          />
        </h3>

        <div className="mt-8 flex items-start gap-5">
          <span
            className="mt-[0.6rem] h-px w-8 shrink-0 bg-night-ink/25"
            aria-hidden="true"
          />
          {/* Held narrow through the tablet widths, where the record player
              fixed to the right of the page reaches this far in and would
              otherwise take the end of the line with it. */}
          <div className="min-w-0 max-w-[13.5rem] lg:max-w-[22rem]">
            <p className="text-[0.6875rem] uppercase leading-[1.8] tracking-[0.24em] text-night-ink/70">
              {t("reserve.ticketsOffline")}
            </p>
            <p className="mt-2 text-[0.8125rem] leading-relaxed text-night-ink/45">
              {t("reserve.ticketsOfflineLead")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
