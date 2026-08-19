/* Who a guest is, written the same way every time.
 *
 * A telephone number is one number however it is typed. The house hears
 * 069 60 60 50 at the door, reads +381 69 606050 off a message and gets
 * 069-606-050 through a form, and all three are the same person ringing about
 * the same table. So nothing is compared as typed: it is reduced to one
 * canonical form first, and that form is what a duplicate is judged on.
 *
 * WHAT IS KEPT AND WHAT IS NOT. The guest's own spelling is kept and shown
 * back to them — it is how they wrote their own number, and the club will read
 * it off a list. The canonical form sits beside it and is never displayed.
 *
 * SERBIA IS THE DEFAULT, NOT THE ONLY OPTION. A local number given as 069…
 * is the same number as +38169…, so the leading zero is traded for the country
 * code. A number that arrives with some other country code is left on it —
 * guests come from over the border, and rewriting their number as Serbian
 * would quietly merge two different people. */

const RS = "381";

/* Digits, and a leading plus if there was one. Everything a human might type
   between them — spaces, dashes, brackets, dots, slashes — is punctuation. */
function digitsOf(raw: string) {
  const trimmed = raw.trim();
  const plus = trimmed.startsWith("+") || trimmed.startsWith("00");
  const digits = trimmed.replace(/\D/g, "");
  return { plus, digits: plus && digits.startsWith("00") ? digits.slice(2) : digits };
}

/* The one form of a telephone number, or null when there is not enough of one
   to be worth storing. Never used for display. */
export function normalizePhone(raw: string): string | null {
  const { plus, digits } = digitsOf(raw ?? "");
  if (digits.length < 6 || digits.length > 15) return null;

  /* Already carrying the country code, with or without the plus in front. */
  if (digits.startsWith(RS)) return `+${digits}`;

  /* A local number: 069… is +381 69…, and the trunk zero goes with the
     change. */
  if (digits.startsWith("0")) return `+${RS}${digits.slice(1)}`;

  /* Somebody else's country code, typed with a plus. Left as it is. */
  if (plus) return `+${digits}`;

  /* A bare local number with no trunk zero — 69 60 60 50. Serbian mobile and
     landline numbers all start 6, 1, 2 or 3 once the zero is off, so this is
     read as local rather than as an unknown country. */
  return `+${RS}${digits}`;
}

/* Case and surrounding space are not identity: MARKO@Gmail.com and
   marko@gmail.com are one address and one guest.
   Nothing cleverer than that is attempted. Stripping dots or +tags is a
   provider-specific trick that is right for one mail host and wrong for the
   next, and being wrong here means turning two people into one. */
export function normalizeEmail(raw: string): string | null {
  const value = (raw ?? "").trim().toLowerCase();
  if (value.length < 5 || !value.includes("@")) return null;
  return value;
}
