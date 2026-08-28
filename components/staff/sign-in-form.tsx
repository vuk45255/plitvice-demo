"use client";

import { useActionState } from "react";
import { signIn, type StaffFormState } from "@/app/(operations)/osoblje/actions";
import { t } from "@/lib/ticketing/copy";

/* The sign-in form.
 *
 * The only client component in the staff area, and it is one because a form
 * that says "wrong password" without a full page reload is the difference
 * between one attempt and three in a doorway at midnight.
 *
 * IT KNOWS NOTHING. It posts a password to a server action and paints whatever
 * comes back; it does not know what the roles are, which password belongs to
 * which, or whether either is configured. `autoComplete="current-password"` so
 * a doorman's phone offers to remember it, which is what actually happens on a
 * club's phone whatever anybody's policy says. */

export function SignInForm({ doors, next }: { doors: string[]; next: string }) {
  const [state, action, pending] = useActionState<StaffFormState, FormData>(
    signIn,
    {},
  );

  return (
    <form action={action} className="mt-10 flex flex-col gap-6">
      <input type="hidden" name="next" value={next} />

      <div className="flex flex-col gap-3">
        <label
          htmlFor="staff-password"
          className="text-[0.625rem] uppercase tracking-[0.3em] text-night-ink/45"
        >
          {t.gateLabel}
        </label>
        <input
          id="staff-password"
          name="password"
          type="password"
          autoComplete="current-password"
          autoFocus
          className="h-14 w-full border-b border-line bg-transparent text-center font-mono text-[1.125rem] tracking-[0.14em] text-night-ink outline-none transition-colors duration-500 focus:border-gold"
        />
      </div>

      {/* Only shown when the club has more than one door. One door is not a
          choice, and a select with one option in it is furniture. */}
      {doors.length > 1 ? (
        <div className="flex flex-col gap-3">
          <label
            htmlFor="staff-door"
            className="text-[0.625rem] uppercase tracking-[0.3em] text-night-ink/45"
          >
            {t.gateDoor}
          </label>
          <select
            id="staff-door"
            name="door"
            className="h-12 w-full border-b border-line bg-transparent text-center text-[0.9375rem] text-night-ink outline-none focus:border-gold"
          >
            {doors.map((door) => (
              <option key={door} value={door} className="bg-night">
                {door}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <input type="hidden" name="door" value={doors[0]} />
      )}

      {state.error ? (
        <p role="alert" className="text-center text-[0.8125rem] text-[#e6a091]">
          {state.error === "closed" ? t.gateClosed : t.gateWrong}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="btn-gold btn-gold-night mx-auto disabled:opacity-40"
      >
        {pending ? "…" : t.gateSubmit}
      </button>
    </form>
  );
}
