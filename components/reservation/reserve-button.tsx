"use client";

import { useReservation } from "@/components/providers/reservation";
import { useLang } from "@/components/providers/language";
import type { MessageKey } from "@/lib/i18n";

/* The house button, wired to the reservation room. Every "Rezervacija" on the
   site is one of these — nothing anywhere still points at Instagram. */
export function ReserveButton({
  label = "common.reserve",
  className = "",
  night = false,
}: {
  label?: MessageKey;
  className?: string;
  night?: boolean;
}) {
  const { openReservation } = useReservation();
  const { t } = useLang();

  return (
    <button
      type="button"
      onClick={openReservation}
      className={`btn-gold btn-gold-sm ${night ? "btn-gold-night" : ""} ${className}`}
    >
      {t(label)}
    </button>
  );
}
