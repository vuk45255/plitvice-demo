import { after } from "next/server";

/* WORK THAT HAPPENS AFTER THE ANSWER HAS GONE OUT.
 *
 * Sending a guest their tickets must not hold up the response that tells the
 * payment provider "received" — a mail service having a slow morning would
 * turn into a webhook timeout, and a timed-out webhook is a webhook the
 * provider retries. So delivery is started and not awaited.
 *
 * ═══ WHY `void promise` IS NOT ENOUGH ON VERCEL ═══════════════════════════
 *
 * A serverless function is not a server. The moment its response is finished
 * the platform may FREEZE the instance — the event loop stops, the in-flight
 * fetch to the mail provider never resolves, and the instance may then be
 * thawed for an unrelated request minutes later or discarded entirely. A
 * promise nobody is waiting on is exactly the thing that gets lost, and what
 * is lost here is a paying guest's tickets.
 *
 * `after()` is the platform's own answer: the callback runs once the response
 * is flushed and the runtime keeps the instance alive until it settles. On a
 * long-running Node server it behaves the same way for free.
 *
 * ═══ WHY IT IS WRAPPED ════════════════════════════════════════════════════
 *
 * `after` only exists inside a request or render scope, and THROWS outside one.
 * `confirmPayment` is also called by the test suite and could one day be called
 * by a script, and neither of those has a scope — so a missing scope falls back
 * to a plain floating promise, which is correct in a process that is not going
 * to be frozen. The fallback is the exception; the point of the file is the
 * first branch.
 *
 * Nothing scheduled here may throw at its caller: a payment that has already
 * been taken is not undone by a mail server. */
export function afterResponse(work: () => Promise<unknown>): void {
  const guarded = async () => {
    try {
      await work();
    } catch (error: unknown) {
      /* Recorded where the work itself records failures — see
         lib/mail/send.ts and lib/ticketing/delivery.ts. This is the last net,
         and it exists so an unexpected throw cannot become an unhandled
         rejection that takes an instance down mid-night. */
      console.error("[after] background work failed", error);
    }
  };

  try {
    after(guarded);
  } catch {
    /* No request scope (a test, a script). A floating promise is the right
       behaviour there, because nothing is about to freeze. */
    void guarded();
  }
}
