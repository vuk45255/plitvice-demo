import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { Lockup } from "@/components/lockup";
import { SignInForm } from "@/components/staff/sign-in-form";
import { anyStaffConfigured, doors, gateFor } from "@/lib/staff/accounts";
import { currentStaff } from "@/lib/staff/session";
import { t } from "@/lib/ticketing/copy";

/* /osoblje — the one way in to the back of the house.
 *
 * Both staff surfaces send people here and both read the same session
 * afterwards. There is one sign-in for the club rather than one per screen,
 * which is what stops a doorman having to remember which page has which code.
 *
 * WITH NOTHING CONFIGURED IN PRODUCTION IT DOES NOT EXIST. See
 * lib/staff/accounts.ts — a staff area that falls open when a variable is
 * missing is a staff area that will one day be open. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Osoblje",
  robots: { index: false, follow: false, nocache: true },
};

export default async function StaffSignInPage({
  searchParams,
}: PageProps<"/osoblje">) {
  if (!anyStaffConfigured()) notFound();

  const params = await searchParams;
  const raw = typeof params.next === "string" ? params.next : "";
  const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : "";

  /* Already signed in: nobody wants to look at a sign-in form they do not
     need. Straight to wherever they were going, or to whichever screen their
     role opens. */
  const staff = await currentStaff();
  if (staff) redirect(next || (staff.role === "admin" ? "/admin" : "/scanner"));

  const open = gateFor("admin") === "open" || gateFor("scanner") === "open";

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[24rem] flex-col justify-center px-6 py-16">
      <header className="text-center">
        <Lockup size="xs" tone="light" />
        <h1 className="mt-9 font-serif text-[clamp(1.375rem,6vw,1.75rem)] leading-tight text-night-ink">
          {t.gateTitle}
        </h1>
        <p className="mt-4 text-[0.8125rem] leading-relaxed text-night-ink/50">
          {t.gateBody}
        </p>
      </header>

      {open ? (
        /* Loudly unlocked rather than quietly. A development machine with no
           passwords set still opens, and says on the screen that this is why. */
        <p className="mt-8 border border-[#e6a091]/30 bg-[#e6a091]/[0.06] px-4 py-3 text-[0.6875rem] leading-relaxed text-[#e6a091]">
          {t.gateOpenWarning}
        </p>
      ) : null}

      <SignInForm doors={doors()} next={next} />
    </main>
  );
}
