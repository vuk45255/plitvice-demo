"use client";

import { useLang } from "@/components/providers/language";
import { SEAT_KINDS, ZONE_LABELS } from "@/lib/floor-plan";
import type { Seat } from "@/lib/floor-availability";

/* Everything a table is called, in one place.
 *
 * The tooltip, the card, the reservation and the screen reader all say the
 * same words about the same table, in the reader's own language, because all
 * of them ask here. Capacities are read from SEAT_KINDS through the seat
 * itself — no component states a minimum or a maximum of its own, so the club
 * changing what a separe holds is one line in lib/floor-plan.ts. */
export function useSeatCopy() {
  const { t } = useLang();

  /* B29, V13, S12 — the club's own number for this table. */
  const number = (seat: Seat) => seat.display;
  const typeLabel = (seat: Seat) => t(SEAT_KINDS[seat.type].label);
  const zoneLabel = (seat: Seat) => t(ZONE_LABELS[seat.zone]);
  const capacity = (seat: Seat) =>
    `${seat.capacity.min}–${seat.capacity.max} ${t("floor.persons")}`;
  const guestCount = (n: number) => `${n} ${t("floor.persons")}`;
  const statusLabel = (seat: Seat) =>
    t(seat.status === "reserved" ? "floor.reserved" : "floor.available");

  /* What the card and the tooltip put at the top: what it is, then which one
     it is — SEPARE S12, BARSKI STO B29, VISOKI STO V13. */
  const heading = (seat: Seat) => `${typeLabel(seat)} ${seat.display}`;

  /* The older, shorter form, still used where the kind is already obvious
     from its surroundings. */
  const title = (seat: Seat) =>
    seat.type === "booth"
      ? `${t("floor.type.booth")} ${seat.display}`
      : `${t("floor.table")} ${seat.display}`;

  const chooseLabel = (seat: Seat) =>
    t(seat.type === "booth" ? "floor.chooseBooth" : "floor.choose");

  /* One spoken line for a table on the map. */
  const ariaLabel = (seat: Seat) =>
    [heading(seat), zoneLabel(seat), capacity(seat), statusLabel(seat)].join(" — ");

  return {
    number,
    heading,
    typeLabel,
    zoneLabel,
    capacity,
    guestCount,
    statusLabel,
    title,
    chooseLabel,
    ariaLabel,
  };
}
