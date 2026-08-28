import { signOut } from "@/app/(operations)/osoblje/actions";
import { AdminSidebar, AdminTopBar } from "@/components/admin/nav";
import { requireStaff } from "@/lib/staff/guard";
import "./admin.css";

/* /admin — the club's operational side.
 *
 * THE GUARD IS HERE, at the top of the layout, so that every page underneath
 * inherits it and none of them can be added later without one. Each page calls
 * `requireStaff` again for itself, which is not redundancy for its own sake:
 * a layout in the App Router is not a security boundary — it renders around a
 * page, it does not gate it — and the route handlers behind these screens
 * check a third time. Layers, in that order.
 *
 * ═══ THE SHELL ════════════════════════════════════════════════════════════
 *
 * A column of navigation on a laptop, a bar and a drawer on a phone — see
 * components/admin/nav.tsx, which is the only client component in the office's
 * chrome. The content column is capped at 78rem: an operational table stretched
 * across a 32-inch monitor is a table nobody can read a row of.
 *
 * ═══ WHY THE STYLESHEET IS IMPORTED HERE ══════════════════════════════════
 *
 * `admin.css` is imported by this layout and by nothing else, and every rule in
 * it is scoped under `.adm`. The public site cannot be reached by it — which is
 * the point, and is a stronger guarantee than a promise not to edit the wrong
 * file. It is also not loaded by /scanner or by a guest's ticket page, which
 * open on whatever signal reaches a doorway.
 *
 * NOT CINEMATIC, ON PURPOSE. See components/admin/shell.tsx. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const staff = await requireStaff("admin");

  /* Rendered once and handed to both shapes of the navigation, so signing out
     is the same server action whichever one is on screen. */
  const signOutButton = (
    <form action={signOut}>
      <button type="submit" className="adm-btn adm-btn--sm w-full">
        Odjavi se
      </button>
    </form>
  );

  return (
    <div className="adm min-h-dvh">
      <AdminTopBar staffName={staff.name} role={staff.role} signOut={signOutButton} />

      <div className="flex min-h-dvh">
        <AdminSidebar staffName={staff.name} role={staff.role} signOut={signOutButton} />

        <main className="min-w-0 flex-1">
          <div className="mx-auto w-full max-w-[78rem] px-4 pb-24 pt-5 sm:px-6 lg:px-10 lg:pt-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
