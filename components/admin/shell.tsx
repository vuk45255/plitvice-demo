import type { ReactNode } from "react";

/* THE OFFICE'S FURNITURE.
 *
 * Deliberately plain, and plain is not the same as unconsidered. The club's
 * site is a slow, dark, cinematic thing and that is right for somebody being
 * sold a night out; it is exactly wrong for somebody standing behind a bar at
 * one in the morning trying to find out whether the party of six at the door
 * actually paid. So: no motion, no entrance ceremony, no photography, and the
 * display face reserved for a page title and a night's name.
 *
 * It borrows the club's palette and its restraint — warm white on purple-black,
 * gold used once per view — and nothing else. See admin.css, where the whole
 * vocabulary is written down and scoped so it can never reach the public site.
 *
 * Everything here is a server component. Nothing in the office's chrome needs
 * JavaScript, and every kilobyte of it is a kilobyte a doorman's phone loads on
 * one bar of signal. */

/* ── the top of a page ──────────────────────────────────────────────────── */

/* Every screen opens the same way: a small eyebrow saying where you are, a
   title in the house face, and — optionally — the one control that belongs to
   the whole page. */
export function PageHeader({
  eyebrow,
  title,
  lede,
  action,
}: {
  eyebrow?: string;
  title: string;
  lede?: string;
  action?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4 pb-6 pt-1">
      <div className="min-w-0">
        {eyebrow ? <p className="adm-eyebrow">{eyebrow}</p> : null}
        <h1 className="adm-display mt-2 text-[clamp(1.375rem,4vw,1.75rem)] text-[var(--adm-ink)]">
          {title}
        </h1>
        {lede ? (
          <p className="mt-2 max-w-[42ch] text-[0.8125rem] leading-relaxed text-[var(--adm-ink-3)]">
            {lede}
          </p>
        ) : null}
      </div>
      {action ? <div className="flex flex-wrap gap-3">{action}</div> : null}
    </header>
  );
}

/* ── a panel ────────────────────────────────────────────────────────────── */

export function Panel({
  title,
  action,
  children,
  className = "",
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`adm-panel mb-6 ${className}`}>
      {title || action ? (
        <header className="adm-panel-head">
          {title ? <h2 className="adm-panel-title">{title}</h2> : <span />}
          {action}
        </header>
      ) : null}
      {children}
    </section>
  );
}

/* A table that scrolls sideways INSIDE ITSELF rather than pushing the page
   wide. A doorman on a 375px phone must never have to scroll the whole
   document horizontally to read a column. */
export function Scroller({ children }: { children: ReactNode }) {
  return <div className="w-full overflow-x-auto">{children}</div>;
}

/* ── a number ───────────────────────────────────────────────────────────── */

/* THE UNIT THE DASHBOARD IS BUILT FROM. A small upper-case label, one large
   figure, and — where it helps — the number it is out of, plus a line of
   context underneath. The tone lights a two-pixel rail down the left edge and
   the figure itself; nothing else changes, because six cards each shouting a
   different colour is six cards nobody reads. */
export function Stat({
  label,
  value,
  of,
  note,
  tone = "plain",
}: {
  label: string;
  value: string | number;
  /* "184 / 300" — the denominator, quieter than the number. */
  of?: string | number;
  note?: string;
  tone?: "plain" | "good" | "warn" | "gold";
}) {
  return (
    <div className={`adm-stat ${tone === "plain" ? "" : `adm-stat--${tone}`}`}>
      <p className="adm-label">{label}</p>
      <p className="adm-stat-value">
        {value}
        {of !== undefined ? <span className="adm-stat-of"> / {of}</span> : null}
      </p>
      {note ? <p className="adm-stat-note">{note}</p> : null}
    </div>
  );
}

/* ── nothing to show ────────────────────────────────────────────────────── */

/* AN EMPTY LIST IS A SENTENCE, NOT A BLANK. It says what is not there and, when
   there is one, what to do about it — because "no reservations" and "you have
   not chosen a night" look identical to somebody in a hurry. */
export function Empty({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-4 px-[1.125rem] py-10">
      <p className="text-[0.875rem] leading-relaxed text-[var(--adm-ink-3)]">
        {children}
      </p>
      {action}
    </div>
  );
}

/* Something went wrong, said in words a member of staff can act on. Whatever
   the database actually said is in the server's log and stays there — a raw
   constraint name on a screen at 3am helps nobody in the building. */
export function Problem({ children }: { children: ReactNode }) {
  return (
    <p
      role="status"
      className="rounded-[3px] border border-[rgba(224,138,134,0.3)] bg-[rgba(224,138,134,0.06)] px-4 py-3 text-[0.8125rem] leading-relaxed text-[var(--adm-bad)]"
    >
      {children}
    </p>
  );
}

/* Something worth knowing that is not a failure: a table somebody else is
   mid-way through booking, a night that is not on sale yet. */
export function Notice({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-[3px] border border-[rgba(224,170,98,0.28)] bg-[rgba(224,170,98,0.06)] px-4 py-3 text-[0.8125rem] leading-relaxed text-[var(--adm-warn)]">
      {children}
    </p>
  );
}

/* ── a form's field ─────────────────────────────────────────────────────── */

export function Field({
  label,
  htmlFor,
  hint,
  full,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  full?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={full ? "sm:col-span-2" : undefined}>
      <label htmlFor={htmlFor} className="adm-label">
        {label}
      </label>
      <div className="mt-2">{children}</div>
      {hint ? (
        <p className="mt-2 text-[0.6875rem] leading-relaxed text-[var(--adm-ink-4)]">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/* A heading inside a long form — OSNOVNO, PRODAJA, KAPACITET. Fifteen inputs
   in one blob is a form nobody fills in correctly at speed. */
export function FormSection({ title }: { title: string }) {
  return (
    <div className="mt-2 border-t border-[var(--adm-line-soft)] pt-6 first:mt-0 first:border-0 first:pt-0 sm:col-span-2">
      <p className="adm-eyebrow">{title}</p>
    </div>
  );
}
