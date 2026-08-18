"use client";

import { useId, useMemo, useState } from "react";
import { Arrow } from "@/components/arrow";
import { Field } from "@/components/reservation/field";
import { useLang } from "@/components/providers/language";
import { validateField, formatPrice, type BookingField } from "@/lib/booking";
import { startCheckout } from "@/lib/checkout";
import { ticketTypes, type PartyEvent, type TicketType } from "@/lib/events";
import type { MessageKey } from "@/lib/i18n";

/* Buying entry to one night.
 *
 * Quantity, what that comes to, who is coming, and the way to pay — in that
 * order, down one column, with the room's own hairlines doing the dividing.
 * The total is derived on every render, so the figure at the bottom can never
 * disagree with the stepper at the top.
 *
 * The button hands a finished order to `startCheckout` in lib/checkout.ts and
 * travels wherever that sends it. No provider answers yet, so today it collects
 * the order, finds nowhere to go, and settles back — it never invents a
 * payment, an order number or a ticket. Wiring the provider is that one
 * function; nothing in this file changes. */

const BUYER: BookingField[] = ["name", "email", "phone"];

export function TicketStep({ event }: { event: PartyEvent }) {
  const types = ticketTypes(event);
  if (types.length === 0) return null;

  return <TicketPurchase event={event} types={types} />;
}

function TicketPurchase({
  event,
  types,
}: {
  event: PartyEvent;
  types: TicketType[];
}) {
  const { t, lang } = useLang();
  const uid = useId();

  const [typeId, setTypeId] = useState(types[0].id);
  const [quantity, setQuantity] = useState(1);
  const [buyer, setBuyer] = useState({ name: "", email: "", phone: "" });
  const [errors, setErrors] = useState<Partial<Record<BookingField, MessageKey>>>(
    {},
  );
  /* A field only starts complaining once the guest has left it, or once they
     have tried to pay. Nobody is told they are wrong mid-word. */
  const [touched, setTouched] = useState<Partial<Record<BookingField, boolean>>>(
    {},
  );
  const [working, setWorking] = useState(false);

  const type = useMemo(
    () => types.find((candidate) => candidate.id === typeId) ?? types[0],
    [types, typeId],
  );

  const soldOut = event.tickets.sale === "soldout";
  const max = Math.min(event.tickets.maxPerOrder, type.remaining ?? Infinity);
  const total = type.price * quantity;

  const set = (field: BookingField) => (value: string) => {
    setBuyer((b) => ({ ...b, [field]: value }));
    if (touched[field]) {
      setErrors((e) => ({ ...e, [field]: validateField(field, value) ?? undefined }));
    }
  };

  const blur = (field: BookingField) => () => {
    setTouched((s) => ({ ...s, [field]: true }));
    setErrors((e) => ({
      ...e,
      [field]:
        validateField(field, buyer[field as keyof typeof buyer]) ?? undefined,
    }));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (working || soldOut) return;

    const next: Partial<Record<BookingField, MessageKey>> = {};
    for (const field of BUYER) {
      const problem = validateField(field, buyer[field as keyof typeof buyer]);
      if (problem) next[field] = problem;
    }
    setErrors(next);
    setTouched(Object.fromEntries(BUYER.map((f) => [f, true])));

    if (Object.keys(next).length > 0) {
      /* Put the buyer on the first thing that needs them. */
      const first = BUYER.find((f) => next[f]);
      document.getElementById(`${uid}-${first}`)?.focus();
      return;
    }

    setWorking(true);
    const checkout = await startCheckout({
      eventSlug: event.slug,
      items: [{ typeId: type.id, quantity }],
      buyer,
    });

    if (checkout) {
      window.location.assign(checkout.redirectUrl);
      return;
    }
    setWorking(false);
  };

  return (
    <form onSubmit={onSubmit} noValidate className="pb-14 pt-2 md:pb-20">
      {types.length > 1 ? (
        <fieldset className="mb-14">
          <legend className="text-[0.625rem] uppercase tracking-[0.3em] text-night-ink/45">
            {t("tickets.type")}
          </legend>
          <div className="mt-6">
            {types.map((candidate) => (
              <TypeRow
                key={candidate.id}
                name={`${uid}-type`}
                type={candidate}
                checked={candidate.id === type.id}
                onSelect={() => {
                  setTypeId(candidate.id);
                  setQuantity(1);
                }}
              />
            ))}
          </div>
        </fieldset>
      ) : null}

      <Quantity
        id={`${uid}-quantity`}
        value={quantity}
        max={max}
        onChange={setQuantity}
      />

      {/* What that comes to. Two lines and a rule — the shape of a bill, not a
          basket. */}
      <div className="mt-14 max-w-[26rem]">
        <div className="flex items-baseline justify-between gap-6">
          <span className="text-[0.875rem] text-night-ink/60">
            <span className="tabular-nums">{quantity}</span> × {t(type.name)}
          </span>
          <span className="tabular-nums text-[0.9375rem] text-night-ink/75">
            {formatPrice(total, lang)}
          </span>
        </div>

        <div className="mt-5 h-px bg-line" aria-hidden="true" />

        <div className="mt-5 flex items-baseline justify-between gap-6">
          <span className="text-[0.6875rem] uppercase tracking-[0.3em] text-night-ink/50">
            {t("tickets.total")}
          </span>
          <span
            className="font-serif text-[clamp(1.5rem,3vw,2rem)] tabular-nums leading-none text-gold-light"
            aria-live="polite"
          >
            {formatPrice(total, lang)}
          </span>
        </div>
      </div>

      <div className="mt-16 grid grid-cols-1 gap-x-10 gap-y-9 md:grid-cols-2">
        <Field
          id={`${uid}-name`}
          name="name"
          label={t("reserve.name")}
          type="text"
          autoComplete="name"
          value={buyer.name}
          error={errors.name}
          onChange={set("name")}
          onBlur={blur("name")}
          className="md:col-span-2"
        />
        <Field
          id={`${uid}-email`}
          name="email"
          label={t("reserve.email")}
          type="email"
          inputMode="email"
          autoComplete="email"
          spellCheck={false}
          value={buyer.email}
          error={errors.email}
          onChange={set("email")}
          onBlur={blur("email")}
        />
        <Field
          id={`${uid}-phone`}
          name="phone"
          label={t("reserve.phoneShort")}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={buyer.phone}
          error={errors.phone}
          onChange={set("phone")}
          onBlur={blur("phone")}
        />
      </div>

      <div className="mt-14">
        <button
          type="submit"
          disabled={working || soldOut}
          className="btn-gold btn-gold-night w-full text-center disabled:cursor-default disabled:opacity-50 md:w-auto"
        >
          <span className="inline-flex items-center gap-5">
            {soldOut
              ? t("tickets.soldOut")
              : working
                ? t("reserve.sending")
                : t("tickets.pay")}
            {soldOut ? null : <Arrow className="w-7" />}
          </span>
        </button>
      </div>
    </form>
  );
}

function TypeRow({
  name,
  type,
  checked,
  onSelect,
}: {
  name: string;
  type: TicketType;
  checked: boolean;
  onSelect: () => void;
}) {
  const { t, lang } = useLang();

  return (
    <label
      className={`flex cursor-pointer items-baseline justify-between gap-6 border-b py-5 transition-colors duration-500 ${
        checked ? "border-gold/60" : "border-line hover:border-gold/30"
      }`}
    >
      <span className="flex items-baseline gap-4">
        <input
          type="radio"
          name={name}
          checked={checked}
          onChange={onSelect}
          className="sr-only"
        />
        <span
          className={`text-[0.8125rem] uppercase tracking-[0.24em] transition-colors duration-500 ${
            checked ? "text-gold-light" : "text-night-ink/70"
          }`}
        >
          {t(type.name)}
        </span>
        {type.note ? (
          <span className="text-[0.75rem] text-night-ink/40">{t(type.note)}</span>
        ) : null}
      </span>
      <span className="tabular-nums text-[0.9375rem] text-night-ink/80">
        {formatPrice(type.price, lang)}
      </span>
    </label>
  );
}

/* Hairline stepper: two hit targets and a number, no spinner arrows. */
function Quantity({
  id,
  value,
  max,
  onChange,
}: {
  id: string;
  value: number;
  max: number;
  onChange: (next: number) => void;
}) {
  const { t } = useLang();

  return (
    <div>
      <label
        htmlFor={id}
        className="block text-[0.625rem] uppercase tracking-[0.3em] text-night-ink/45"
      >
        {t("tickets.count")}
      </label>

      <div className="mt-5 flex w-fit items-center gap-7 border-b border-line pb-3">
        <button
          type="button"
          onClick={() => onChange(Math.max(1, value - 1))}
          disabled={value <= 1}
          aria-label={t("tickets.fewer")}
          className="flex h-11 w-11 items-center justify-center text-night-ink/70 transition-colors duration-500 hover:text-gold disabled:opacity-25"
        >
          <span className="block h-px w-4 bg-current" aria-hidden="true" />
        </button>

        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={1}
          max={max}
          value={value}
          autoComplete="off"
          onChange={(e) =>
            onChange(Math.min(max, Math.max(1, Number(e.target.value) || 1)))
          }
          className="w-14 border-none bg-transparent text-center font-serif text-[1.75rem] tabular-nums leading-none text-night-ink outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />

        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          aria-label={t("tickets.more")}
          className="relative flex h-11 w-11 items-center justify-center text-night-ink/70 transition-colors duration-500 hover:text-gold disabled:opacity-25"
        >
          <span className="block h-px w-4 bg-current" aria-hidden="true" />
          <span className="absolute block h-4 w-px bg-current" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
