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

/* Every screen opens the same way: the title in the house face, and —
 * optionally — the one control that belongs to the whole page.
 *
 * ═══ THERE IS NO EYEBROW, AND THAT IS THE POINT ═══════════════════════════
 *
 * This used to carry a small upper-case label above every title: DOBAR DAN
 * over the control centre, PREGLED over a preview, PROGRAM over the programme,
 * SALA over the floor. Every one of them was decoration. The screen is already
 * named — by the navigation, by the title under it, by the URL — and a word
 * repeating that in 9px caps costs a line of vertical space on a phone and
 * tells a manager at 1am precisely nothing they did not know.
 *
 * The labels that stayed are the ones INSIDE the cards: KARTE PRODATE,
 * SKENIRANO, REZERVACIJE, ZAUZETI STOLOVI. Those name a figure that would be
 * meaningless without them. That is the test — a label earns its place by
 * saying what a number is, not by saying where you are. */
export function PageHeader({
  title,
  /* One line of real information under the title where a screen genuinely has
     one: a night's date and start time, a count, what the page is for. Not a
     tagline — an empty `lede` is better than a decorative one. */
  meta,
  lede,
  action,
  /* `lg` for a screen whose title is the whole of its heading — the floor plan
      has no eyebrow, no lede and nothing else at the top, and at the default
      size it read as a caption over a large drawing rather than as the name of
      the page. Two sizes, not a free number: a heading scale with more than
      two steps in it is a heading scale nobody keeps to. */
  size = "md",
}: {
  title: string;
  meta?: ReactNode;
  lede?: string;
  action?: ReactNode;
  size?: "md" | "lg";
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4 pb-6 pt-1">
      <div className="min-w-0">
        <h1
          className={`adm-display text-[var(--adm-ink)] ${
            size === "lg"
              ? "text-[clamp(1.75rem,5vw,2.25rem)]"
              : "text-[clamp(1.375rem,4vw,1.75rem)]"
          }`}
        >
          {title}
        </h1>
        {meta ? (
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-[0.8125rem] text-[var(--adm-ink-3)]">
            {meta}
          </div>
        ) : null}
        {lede ? (
          <p className="mt-2 max-w-[46ch] text-[0.8125rem] leading-relaxed text-[var(--adm-ink-3)]">
            {lede}
          </p>
        ) : null}
      </div>
      {action ? <div className="flex flex-wrap gap-2.5">{action}</div> : null}
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

/* THE GRID THE STAT CARDS STAND IN. One rule, so every metric row on every
   screen breaks at the same widths — two up on a phone, and never one enormous
   card per line, which is what `grid-cols-1` gives you at 360px and is a
   scroll for no reason. */
export function StatGrid({
  children,
  cols = 4,
}: {
  children: ReactNode;
  /* How many across at the widest. Below that it is always 2 on a phone and 3
     from `sm`, because that is what stays legible rather than what divides
     evenly. */
  cols?: 3 | 4 | 5 | 6;
}) {
  const wide = {
    3: "lg:grid-cols-3",
    4: "lg:grid-cols-4",
    5: "lg:grid-cols-5",
    6: "lg:grid-cols-6",
  }[cols];
  return (
    <div className={`mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 ${wide}`}>
      {children}
    </div>
  );
}

/* ── one fact, listed ───────────────────────────────────────────────────── */

/* A LABEL AND A VALUE, OR THE HONEST ABSENCE OF ONE.
 *
 * Used wherever the office is checking what a night says rather than reading a
 * measurement. A missing value is SHOWN as missing rather than hidden: finding
 * out what has not been filled in is usually the reason somebody opened the
 * screen, and a field that disappears when empty cannot be noticed. */
export function Line({
  label,
  value,
  wide,
  empty = "nije uneto",
}: {
  label: string;
  value?: ReactNode;
  wide?: boolean;
  empty?: string;
}) {
  const missing = value === undefined || value === null || value === "";
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="adm-label">{label}</dt>
      <dd
        className={`mt-1.5 text-[0.875rem] leading-relaxed ${
          missing ? "text-[var(--adm-ink-4)]" : "text-[var(--adm-ink)]"
        }`}
      >
        {missing ? empty : value}
      </dd>
    </div>
  );
}

/* A row inside a panel: the name of a figure on the left, the figure on the
   right. The shape a summary takes when it is a list of eight things rather
   than four cards — a sales breakdown reads far better this way than as eight
   tiles, and Fourvenues' own rate breakdown is the same shape for the same
   reason. */
export function DataRow({
  label,
  value,
  note,
  tone = "plain",
}: {
  label: string;
  value: ReactNode;
  note?: string;
  tone?: "plain" | "good" | "warn" | "bad" | "gold" | "muted";
}) {
  const colour = {
    plain: "text-[var(--adm-ink)]",
    good: "text-[var(--adm-good)]",
    warn: "text-[var(--adm-warn)]",
    bad: "text-[var(--adm-bad)]",
    gold: "text-[var(--adm-gold-light)]",
    muted: "text-[var(--adm-ink-4)]",
  }[tone];

  return (
    <div className="adm-data-row">
      <div className="min-w-0">
        <p className="text-[0.8125rem] text-[var(--adm-ink-2)]">{label}</p>
        {note ? (
          <p className="mt-0.5 text-[0.6875rem] leading-relaxed text-[var(--adm-ink-4)]">
            {note}
          </p>
        ) : null}
      </div>
      <p className={`adm-figure shrink-0 text-[0.9375rem] ${colour}`}>{value}</p>
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
   in one blob is a form nobody fills in correctly at speed.

   `children` is for a heading that is more than a word: the event editor
   numbers its steps, and a number in a circle beside the word is what turns a
   long form into something somebody will finish standing up. Passing children
   REPLACES the title rather than adding to it, so there is never a heading
   rendered twice. */
export function FormSection({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="mt-2 border-t border-[var(--adm-line-soft)] pt-6 first:mt-0 first:border-0 first:pt-0 sm:col-span-2">
      {children ?? <p className="adm-eyebrow">{title}</p>}
    </div>
  );
}
