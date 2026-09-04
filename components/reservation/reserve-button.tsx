"use client";

import Link from "next/link";
import { useLang } from "@/components/providers/language";
import { reserveHref, type ReserveChoice } from "@/lib/events";
import { warmReservationAssets } from "@/lib/reservation-warmup";
import type { MessageKey } from "@/lib/i18n";

/* The house button, pointed at the reservation room. Every "Rezervacija" on
   the site is one of these, and every one of them is a real link — it can be
   opened in a new tab, shared, and it works before any JavaScript arrives.
   Pass a night to open the room on it.

   A pointer resting on it, or a Tab landing on it, is as much notice as the
   room is ever going to get, so it is when the one picture that route opens
   with is fetched. What that costs and what it refuses to do is written out
   in lib/reservation-warmup.ts. */
export function ReserveButton({
  label = "common.reserve",
  className = "",
  night = false,
  event,
  choice,
}: {
  label?: MessageKey;
  className?: string;
  night?: boolean;
  event?: string;
  choice?: ReserveChoice;
}) {
  const { t } = useLang();

  return (
    <Link
      href={reserveHref(event, choice)}
      onPointerEnter={warmReservationAssets}
      onFocus={warmReservationAssets}
      className={`btn-gold btn-gold-sm ${night ? "btn-gold-night" : ""} ${className}`}
    >
      {t(label)}
    </Link>
  );
}
