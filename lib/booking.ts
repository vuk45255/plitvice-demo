import type { MessageKey } from "@/lib/i18n";

/* What the house needs to hold a table, and what it will need to sell a
   ticket. Both steps of the reservation room validate through here, so a
   phone number is judged the same way whichever line the guest is standing in.
 *
 * Nothing in this file talks to a server. When the club has an endpoint — a
 * booking inbox, a mail service, a payment provider — `submit` in each step is
 * the single place that changes. */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
/* Serbian numbers arrive as +381 60 123 4567, 060/123-4567, 060 123 4567 —
   accept the punctuation people actually type, then count the digits. */
const PHONE_SHAPE = /^[+(]?[\d\s()\-./]{5,}$/;

export type BookingField = "name" | "phone" | "email" | "guests" | "time";

/* Returns the message key for whatever is wrong, or null when the field is
   good. Both the table step and the ticket step read from this list. */
export function validateField(
  field: BookingField,
  raw: string,
): MessageKey | null {
  const value = raw.trim();

  switch (field) {
    case "name":
      return value.length >= 2 ? null : "reserve.err.name";
    case "phone": {
      const digits = value.replace(/\D/g, "");
      return PHONE_SHAPE.test(value) && digits.length >= 6 && digits.length <= 15
        ? null
        : "reserve.err.phone";
    }
    case "email":
      return EMAIL.test(value) ? null : "reserve.err.email";
    case "guests": {
      const n = Number(value);
      return value !== "" && Number.isInteger(n) && n >= 1 && n <= 50
        ? null
        : "reserve.err.guests";
    }
    case "time":
      return value !== "" ? null : "reserve.err.time";
  }
}

/* Prices are shown in the club's own currency, formatted for the reader's
   language rather than hard-coded. There are no prices in the project yet;
   this is what will render them the day there are. */
export function formatPrice(amount: number, lang: string) {
  return new Intl.NumberFormat(lang === "en" ? "en-GB" : "sr-RS", {
    style: "currency",
    currency: "RSD",
    maximumFractionDigits: 0,
  }).format(amount);
}
