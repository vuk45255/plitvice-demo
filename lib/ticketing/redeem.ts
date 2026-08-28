import { devMode } from "@/lib/ticketing/config";
import { findTicketingEvent } from "@/lib/ticketing/events";
import { tokenFromScan } from "@/lib/ticketing/links";
import { chargeMiss, takeScan } from "@/lib/ticketing/rate-limit";
import { redeem } from "@/lib/ticketing/store";
import { normalizeReference } from "@/lib/ticketing/tokens";
import type { RedemptionResult } from "@/lib/ticketing/types";

/* THE DOOR.
 *
 * One function. A scanner calls it, a hand-typed reference calls it, and
 * anything the club ever builds afterwards calls it — because the moment there
 * are two ways to let somebody in, there are two answers to whether they may
 * come in, and one of them is wrong.
 *
 * ═══ WHY IT IS ONE STEP AND NOT TWO ═══════════════════════════════════════
 *
 * The obvious shape is: the phone reads a code, asks the server whether the
 * ticket is good, shows green, and then tells the server to mark it used. That
 * shape has a hole in it wide enough for the whole night to walk through. Two
 * doormen, two phones, one code held up twice: both ask, both are told the
 * ticket is valid, both go green, both mark it used. Two people, one ticket.
 * It does not even take malice — it takes a guest who scans their own screen
 * while the doorman is scanning it.
 *
 * So there is no "check". There is only "come in, and it is now used", decided
 * in a single indivisible write in the store, and the phone is TOLD what
 * happened rather than asked to decide it. The first scan wins. Everything
 * after it — a second later, a second phone, a replayed request — is told the
 * ticket is already used, and is told the time of the scan that won.
 *
 * ═══ WHICH NIGHT ═════════════════════════════════════════════════════════
 *
 * A door works one night at a time, and the night is part of the decision
 * rather than something checked afterwards: the UPDATE that marks a ticket
 * used will not touch a ticket belonging to another event, so a ticket for
 * Saturday presented on Friday is refused AND STAYS VALID. Telling somebody
 * their ticket is for another night and then quietly spending it would be the
 * worst of both.
 *
 * ═══ WHAT THE CLIENT IS TRUSTED WITH ══════════════════════════════════════
 *
 * Nothing. It sends a string it read off a camera or out of a text box. This
 * function decides what that string is, whether it names a ticket, whether the
 * ticket may come in, and what the door is allowed to be told — which is the
 * night, the ticket's own reference and a time. NOT THE GUEST'S NAME, not
 * their email, not what they paid. A doorman's phone is the least private
 * screen in the building, it is held up in front of a queue, and none of that
 * is any of its business.
 *
 * NOR IS THE NIGHT THE CLIENT'S TO CHOOSE. `expectedEventId` comes from the
 * staff session's own door setting, on the server — not from the request body,
 * which would make "which night is this ticket for" a question the phone gets
 * to answer.
 *
 * ═══ WHERE ABUSE PROTECTION GOES ══════════════════════════════════════════
 *
 * Around the outside, before any lookup — see lib/ticketing/rate-limit.ts. It
 * is the reason a fifty-bit hand-typable reference is safe to accept at all.
 * The staff session that gates this route is a second layer and not a
 * substitute: a session leaks, and this must hold when it does. */

export type RedeemContext = {
  /* For the brake. An address is a fair signal of a machine and a poor one of
     a person; it is used to slow a flood and for nothing else. */
  source: string;
  /* Which door, when the club has more than one. Recorded on the scan. */
  door?: string;
  /* Which member of staff. Recorded on the ticket, which is what makes
     "who let that person in" answerable. */
  staff?: string;
  /* THE NIGHT THIS DOOR IS WORKING. Null means the door is not filtering,
     which is only ever a deliberate choice on the admin side. */
  eventId?: string | null;
};

/* What was read, before anybody knows what it means: a scanned string, or
   something typed into the manual box. Exactly one is expected. */
export type RedeemInput = { scanned?: string; typed?: string };

export async function validateAndRedeemTicket(
  input: RedeemInput,
  context: RedeemContext,
): Promise<RedemptionResult> {
  /* The brake first, so a flood is turned away before it costs a lookup. */
  const brake = takeScan(context.source);
  if (!brake.ok) {
    return { outcome: "rate_limited", retryAfterSeconds: brake.retryAfterSeconds };
  }

  const key = readKey(input);
  if (!key) {
    /* Not even the shape of a ticket. It never reaches the store, and it is
       charged as a miss — this is what a script's traffic looks like. */
    chargeMiss(context.source);
    return { outcome: "invalid" };
  }

  const outcome = await redeem(
    key,
    context.eventId ?? null,
    context.staff ?? context.door,
    context.door,
  );

  if (outcome.result === "unknown") {
    chargeMiss(context.source);
    return { outcome: "invalid" };
  }

  const ticket = outcome.ticket;
  const event = await findTicketingEvent(ticket.eventId, devMode());

  /* A ticket whose night this server cannot name is not a ticket this server
     may let through — it is a test ticket on a production box, or a night that
     has been removed. Refusing is the safe direction. */
  if (!event) return { outcome: "invalid" };

  const shown = {
    reference: ticket.reference,
    eventTitle: event.title,
    eventDate: event.startsAt,
    scannedAt: ticket.scannedAt,
  };

  switch (outcome.result) {
    case "redeemed":
      return { outcome: "valid", ticket: shown };
    case "already_used":
      return { outcome: "already_used", ticket: shown };
    case "cancelled":
      return { outcome: "cancelled", ticket: shown };
    case "wrong_event":
      /* Deliberately names the night the ticket IS for, so the doorman can
         say "this is for Saturday" instead of "no". The ticket is untouched
         and still valid. */
      return { outcome: "wrong_event", ticket: shown };
  }
}

/* What the door read, turned into what to look it up by.
 *
 * A scan is a URL or a bare token; a typed entry is a reference. They are kept
 * apart on purpose — a doorman typing thirty-two characters of base64 has
 * mistyped it, and a camera does not read PLV-4K7XM-9Q2DT off a screen. Each
 * input is only allowed to mean the thing it can actually be. */
function readKey(input: RedeemInput): { token?: string; reference?: string } | null {
  if (input.scanned) {
    const token = tokenFromScan(input.scanned);
    return token ? { token } : null;
  }
  if (input.typed) {
    const reference = normalizeReference(input.typed);
    return reference ? { reference } : null;
  }
  return null;
}
