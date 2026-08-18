"use client";

import Link from "next/link";
import { useLang } from "@/components/providers/language";
import { reserveHref, type ReserveChoice } from "@/lib/events";
import type { MessageKey } from "@/lib/i18n";

/* The house button, pointed at the reservation room. Every "Rezervacija" on
   the site is one of these, and every one of them is a real link — it can be
   opened in a new tab, shared, and it works before any JavaScript arrives.
   Pass a night to open the room on it. */
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
      className={`btn-gold btn-gold-sm ${night ? "btn-gold-night" : ""} ${className}`}
    >
      {t(label)}
    </Link>
  );
}
