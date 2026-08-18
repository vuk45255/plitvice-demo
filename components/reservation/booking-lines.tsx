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
import { entryPrice, type PartyEvent, type ReserveChoice } from "@/lib/events";
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
  /* A night with nothing priced has no ticket line at all, the same way a
     night that takes no tables has no table line. */
  const sellsTickets =
    event.tickets.enabled && event.tickets.sale !== "closed" && priceLabel !== undefined;

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
      {sellsTickets ? (
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

          <span className="relative min-w-0">
            <span
              className={`block font-serif text-[clamp(1.625rem,3.4vw,2.5rem)] uppercase leading-none tracking-[0.05em] transition-colors duration-500 ${
                open ? "text-gold-light" : "text-night-ink group-hover:text-gold-light"
              }`}
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
