import { Lockup } from "@/components/lockup";
import { t } from "@/lib/ticketing/copy";

/* A link that leads nowhere.
 *
 * IT SAYS NOTHING ABOUT WHY. Not "expired", not "already used", not "this
 * token is malformed" — every one of those is a fact about somebody's ticket
 * given to somebody who does not have it, and together they are a way of
 * mapping which tokens exist. There is one answer to a link that is not a
 * ticket, and this is it.
 *
 * A guest who is actually holding a ticket almost always got here by opening
 * a truncated link out of a message, so that is what the page suggests. */

export default function TicketNotFound() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[25rem] flex-col items-center justify-center px-6 py-16 text-center">
      <Lockup size="xs" tone="light" />

      <h1 className="mt-10 font-serif text-[clamp(1.5rem,6vw,2rem)] leading-tight text-night-ink">
        {t.notFoundTitle}
      </h1>

      <p className="mt-5 max-w-[22rem] text-[0.875rem] leading-relaxed text-night-ink/55">
        {t.notFoundBody}
      </p>
    </main>
  );
}
