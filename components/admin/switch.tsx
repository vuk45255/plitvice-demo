"use client";

import { useId, useState, type ReactNode } from "react";

/* AN ON / OFF THAT IS A CHECKBOX.
 *
 * PRODAJA KARATA and REZERVACIJE STOLOVA are the two switches in the event
 * editor and they are `<input type="checkbox">` with a track drawn over them.
 * That is not a shortcut — it is what makes them submit with the form, work
 * with a keyboard, announce themselves correctly to a screen reader, and
 * survive JavaScript failing to load. A `<div role="switch">` would have to
 * reimplement all four, and would get one of them wrong.
 *
 * The whole row is the label, so the target is the width of the panel rather
 * than the width of a track. On a phone, at one in the morning, that is the
 * difference between a control and a game of darts.
 *
 * ═══ WHY IT HAS STATE AT ALL ══════════════════════════════════════════════
 *
 * Only so the form can show or hide what the switch governs — the price and
 * capacity fields under PRODAJA KARATA. The checkbox itself is uncontrolled in
 * spirit: `defaultChecked` seeds it, the browser owns it, and what is posted is
 * whatever the browser has. `onChange` tells the parent, and nothing else. */
export function Switch({
  name,
  label,
  hint,
  defaultChecked = false,
  onChange,
}: {
  name: string;
  label: string;
  hint?: string;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
}) {
  const id = useId();

  return (
    <label htmlFor={id} className="adm-switch">
      <span className="min-w-0">
        <span className="block text-[0.8125rem] text-[var(--adm-ink)]">{label}</span>
        {hint ? (
          <span className="mt-0.5 block text-[0.6875rem] leading-relaxed text-[var(--adm-ink-4)]">
            {hint}
          </span>
        ) : null}
      </span>

      <input
        id={id}
        name={name}
        type="checkbox"
        defaultChecked={defaultChecked}
        onChange={(event) => onChange?.(event.currentTarget.checked)}
      />
      <span className="adm-switch-track" aria-hidden="true" />
    </label>
  );
}

/* A switch and whatever it governs, so that turning tickets off does not leave
   a price field sitting there implying that somebody should fill it in. The
   hidden half is UNMOUNTED rather than hidden with CSS: a `display:none` input
   still posts, and a price posted for a night that does not sell tickets is a
   number somebody will eventually read. */
export function SwitchSection({
  name,
  label,
  hint,
  defaultChecked = false,
  children,
}: {
  name: string;
  label: string;
  hint?: string;
  defaultChecked?: boolean;
  children: ReactNode;
}) {
  const [on, setOn] = useState(defaultChecked);

  return (
    <div className="sm:col-span-2">
      <Switch
        name={name}
        label={label}
        hint={hint}
        defaultChecked={defaultChecked}
        onChange={setOn}
      />
      {on ? <div className="mt-4 grid gap-5 sm:grid-cols-2">{children}</div> : null}
    </div>
  );
}
