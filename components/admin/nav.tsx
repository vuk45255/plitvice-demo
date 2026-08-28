"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  CalendarDays,
  ClipboardList,
  LayoutGrid,
  Menu,
  QrCode,
  Table2,
  Ticket,
  X,
} from "lucide-react";

/* WHERE YOU ARE, AND WHERE ELSE YOU CAN GO.
 *
 * ═══ TWO SHAPES, NOT ONE SQUEEZED ═════════════════════════════════════════
 *
 * On a laptop this is a column down the left: the wordmark, six destinations,
 * and who is signed in at the bottom. On a phone it is a bar across the top
 * with a drawer behind it, because a 15rem sidebar on a 390px screen is 40% of
 * the screen given to navigation on a device where the whole point is the
 * numbers. The markup is shared; only the container differs, and neither one
 * is the other folded up.
 *
 * ═══ WHAT IS ACTIVE ═══════════════════════════════════════════════════════
 *
 * A two-pixel gold rail, a half-step lighter ground and brighter text. Not a
 * filled pill: this is a list of six things, and a solid block on one of them
 * makes the other five look disabled. `aria-current="page"` carries it, so the
 * styling and the accessibility are the same fact rather than two.
 *
 * The rail is declared transparent on every item, so lighting it moves
 * nothing — a nav that shifts by two pixels as you arrive is a nav that feels
 * broken on a slow connection.
 *
 * ═══ THE ONLY JAVASCRIPT IN THE OFFICE'S CHROME ═══════════════════════════
 *
 * One boolean for whether the drawer is open. Tapping a destination closes it
 * on the way out — otherwise a doorman taps "Karte" and is left looking at the
 * menu he just used — and the page behind it does not scroll while it is over
 * the top. Nothing else here is stateful and nothing animates but colour.
 *
 * Icons come from lucide-react, which is already in this project. No second
 * icon package was added for six glyphs. */

const LINKS = [
  { href: "/admin", label: "Pregled", Icon: LayoutGrid },
  { href: "/admin/rezervacije", label: "Rezervacije", Icon: ClipboardList },
  { href: "/admin/plan", label: "Plan stolova", Icon: Table2 },
  { href: "/admin/karte", label: "Karte", Icon: Ticket },
  { href: "/admin/dogadjaji", label: "Događaji", Icon: CalendarDays },
  { href: "/scanner", label: "Skener", Icon: QrCode },
] as const;

function isActive(pathname: string, href: string): boolean {
  /* /admin matches only itself; everything else matches its own subtree, so
     /admin/dogadjaji/evt_123 still lights "Događaji". */
  return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
}

function Links({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-0.5">
      {LINKS.map(({ href, label, Icon }) => (
        <Link
          key={href}
          href={href}
          onClick={onNavigate}
          aria-current={isActive(pathname, href) ? "page" : undefined}
          className="adm-nav-link"
        >
          <Icon size={15} strokeWidth={1.5} aria-hidden />
          {label}
        </Link>
      ))}
    </nav>
  );
}

/* The house mark, quietly. Two lines, letter-spaced, gold over grey — the
   same lockup the club uses everywhere, without the ceremony. */
function Wordmark() {
  return (
    <div>
      <p className="text-[0.6875rem] uppercase tracking-[0.42em] text-[var(--adm-gold)]">
        Plitvice
      </p>
      <p className="mt-1 text-[0.5rem] uppercase tracking-[0.32em] text-[var(--adm-ink-4)]">
        Night Operations
      </p>
    </div>
  );
}

/* ── the laptop ─────────────────────────────────────────────────────────── */

export function AdminSidebar({
  staffName,
  role,
  signOut,
}: {
  staffName: string;
  role: string;
  signOut: React.ReactNode;
}) {
  return (
    <aside className="sticky top-0 hidden h-dvh w-[13.5rem] shrink-0 flex-col justify-between overflow-y-auto border-r border-[var(--adm-line-soft)] px-3 py-6 lg:flex">
      <div>
        <div className="px-3">
          <Wordmark />
        </div>
        <div className="mt-8">
          <Links />
        </div>
      </div>

      <div className="border-t border-[var(--adm-line-soft)] px-3 pt-4">
        <p className="text-[0.6875rem] text-[var(--adm-ink-2)]">{staffName}</p>
        <p className="mt-0.5 text-[0.5625rem] uppercase tracking-[0.22em] text-[var(--adm-ink-4)]">
          {role === "admin" ? "Uprava" : "Ulaz"}
        </p>
        <div className="mt-3">{signOut}</div>
      </div>
    </aside>
  );
}

/* ── the phone ──────────────────────────────────────────────────────────── */

export function AdminTopBar({
  staffName,
  role,
  signOut,
}: {
  staffName: string;
  role: string;
  signOut: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  /* Arriving somewhere closes the menu you arrived through — done on the link
     itself (`onNavigate` below) rather than by watching the path, so the drawer
     shuts on the tap rather than one render after it. */

  /* While the drawer is over the page, the page behind it does not scroll. */
  useEffect(() => {
    if (!open) return;
    const kept = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = kept;
    };
  }, [open]);

  return (
    <div className="lg:hidden">
      <header className="flex items-center justify-between gap-4 border-b border-[var(--adm-line-soft)] px-4 py-3">
        <Wordmark />
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          aria-label="Meni"
          className="adm-btn adm-btn--sm"
        >
          <Menu size={16} strokeWidth={1.5} aria-hidden />
          Meni
        </button>
      </header>

      {open ? (
        <div className="fixed inset-0 z-50 flex">
          {/* Tapping the room behind the drawer closes it, which is what
              everybody tries first. */}
          <button
            type="button"
            aria-label="Zatvori meni"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-[rgba(4,2,8,0.72)]"
          />
          <div className="relative ml-auto flex h-full w-[min(17rem,82vw)] flex-col justify-between border-l border-[var(--adm-line)] bg-[var(--adm-panel)] px-3 py-5">
            <div>
              <div className="flex items-center justify-between px-3">
                <Wordmark />
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Zatvori"
                  className="adm-btn adm-btn--ghost min-h-[2.75rem]"
                >
                  <X size={18} strokeWidth={1.5} aria-hidden />
                </button>
              </div>
              <div className="mt-6">
                <Links onNavigate={() => setOpen(false)} />
              </div>
            </div>

            <div className="border-t border-[var(--adm-line-soft)] px-3 pt-4">
              <p className="text-[0.75rem] text-[var(--adm-ink-2)]">{staffName}</p>
              <p className="mt-0.5 text-[0.5625rem] uppercase tracking-[0.22em] text-[var(--adm-ink-4)]">
                {role === "admin" ? "Uprava" : "Ulaz"}
              </p>
              <div className="mt-3">{signOut}</div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
