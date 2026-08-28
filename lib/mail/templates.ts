import { site } from "@/lib/site";
import { eventDate, eventTime, price } from "@/lib/ticketing/copy";
import type { MailMessage } from "@/lib/mail/provider";
import { officeAddress } from "@/lib/mail/provider";
import type { TicketDelivery } from "@/lib/ticketing/delivery";
import type { Reservation } from "@/lib/reservations/types";

/* WHAT THE CLUB'S MAIL LOOKS LIKE, AND WHY IT LOOKS SO OLD-FASHIONED.
 *
 * A mail client is not a browser. There is no flexbox in Outlook, no grid, no
 * custom properties, no external stylesheet, no web font that can be relied
 * on, and half of them strip a <style> block. So: TABLES, INLINE STYLES, one
 * 600px column, system faces, and every colour written out. This is not the
 * site's code style being abandoned — it is the only thing that renders the
 * same in Gmail on a phone, Apple Mail and a fifteen-year-old Outlook.
 *
 * The palette is the club's: the same warm gold on the same purple-black. The
 * shapes are not — no grain, no motion, no photography, nothing that costs a
 * megabyte on a train.
 *
 * ═══ WHAT IS DELIBERATELY NOT IN HERE ═════════════════════════════════════
 *
 * NO QR IMAGE. The ticket page draws it — see lib/ticketing/qr.ts — and it
 * draws it live, against the ticket's real state. A QR pasted into a mail is a
 * picture of a ticket that may since have been refunded, and every mail client
 * that blocks images shows the guest an empty box where their ticket was.
 *
 * NO ATTACHMENT. A PDF is a megabyte a doorman cannot re-check and a guest
 * cannot re-download at the door.
 *
 * NO PRICE BREAKDOWN, NO CARD DETAIL, NO PERSONAL DATA BEYOND THE NAME. A
 * mailbox is not a private place; the link is the credential and everything
 * else waits behind it. */

const GOLD = "#c9a961";
const INK = "#f2ece2";
const NIGHT = "#0d0a12";
const MUTED = "#9b93a5";
const LINE = "#2a2431";

const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

/* HTML escaping, because a guest's own name goes into this. Somebody called
   O'Brien & Sons is not a markup bug and "Ana <Ana>" is not an element. */
function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* One column, centred, dark, and legible at 320px. Everything below pours its
   own rows into the middle of this. */
function shell(title: string, rows: string): string {
  return `<!doctype html>
<html lang="sr"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark light">
<title>${esc(title)}</title>
</head>
<body style="margin:0;padding:0;background:${NIGHT};color:${INK};font-family:${FONT};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(title)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${NIGHT};">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#131019;border:1px solid ${LINE};">
  <tr><td style="padding:28px 28px 8px 28px;text-align:center;">
    <div style="font-size:11px;letter-spacing:6px;text-transform:uppercase;color:${GOLD};">
      ${esc(site.name)}
    </div>
    <div style="margin-top:6px;font-size:9px;letter-spacing:3px;text-transform:uppercase;color:${MUTED};">
      ${esc(site.tagline)} &middot; ${esc(site.town)}
    </div>
  </td></tr>
  ${rows}
  <tr><td style="padding:20px 28px 28px 28px;border-top:1px solid ${LINE};">
    <p style="margin:0;font-size:11px;line-height:1.7;color:${MUTED};">
      ${esc(site.street)}, ${esc(site.city)} &middot; ${esc(site.phone)}<br>
      Ovu poruku ste dobili jer ste rezervisali kod nas.
    </p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

/* A button that is a table, because a styled <a> collapses in Outlook. */
function button(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
  <tr><td align="center" bgcolor="${GOLD}" style="border-radius:2px;">
    <a href="${esc(href)}" style="display:inline-block;padding:14px 28px;font-family:${FONT};font-size:13px;letter-spacing:2px;text-transform:uppercase;color:${NIGHT};text-decoration:none;font-weight:600;">${esc(label)}</a>
  </td></tr>
</table>`;
}

function row(label: string, value: string): string {
  return `<tr>
  <td style="padding:6px 0;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:${MUTED};white-space:nowrap;">${esc(label)}</td>
  <td style="padding:6px 0 6px 16px;font-size:14px;color:${INK};">${esc(value)}</td>
</tr>`;
}

/* ── the tickets ────────────────────────────────────────────────────────── */

/* Subject: "Vaše Plitvice karte — <night>". The night is in it because a guest
   with tickets to three parties has three of these in one thread. */
export function ticketMail(delivery: TicketDelivery): MailMessage {
  const { order, event, urls, orderUrl } = delivery;
  const count = delivery.tickets.length;
  const many = count === 1 ? "kartu" : "karte";

  const list = urls
    .map(
      (url, i) =>
        `<li style="margin:0 0 8px 0;"><a href="${esc(url)}" style="color:${GOLD};font-size:13px;">Karta ${i + 1} od ${count}</a></li>`,
    )
    .join("");

  const html = shell(
    `Vaše Plitvice karte — ${event.title}`,
    `<tr><td style="padding:24px 28px 0 28px;">
      <h1 style="margin:0;font-size:22px;line-height:1.3;color:${INK};font-weight:400;">${esc(event.title)}</h1>
      <p style="margin:10px 0 0 0;font-size:14px;color:${MUTED};">
        ${esc(eventDate(event.startsAt))} &middot; ${esc(eventTime(event.doorsAt ?? event.startsAt))}
      </p>
    </td></tr>

    <tr><td style="padding:22px 28px 0 28px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
        ${row("Gost", order.customerName)}
        ${row("Broj porudžbine", order.reference)}
        ${row(count === 1 ? "Karta" : "Karte", String(count))}
        ${row("Iznos", price(order.totalAmount))}
      </table>
    </td></tr>

    <tr><td style="padding:26px 28px 6px 28px;">
      ${button(orderUrl, "Otvori karte")}
      <p style="margin:16px 0 0 0;font-size:12px;line-height:1.7;color:${MUTED};text-align:center;">
        QR kod se prikazuje na stranici karte. Pokažite ga na ulazu —
        jedan kod, jedan ulaz.
      </p>
    </td></tr>

    <tr><td style="padding:18px 28px 26px 28px;">
      <p style="margin:0 0 8px 0;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:${MUTED};">
        Pojedinačne karte
      </p>
      <ul style="margin:0;padding-left:18px;">${list}</ul>
    </td></tr>`,
  );

  const text = [
    `${site.name.toUpperCase()} — ${event.title}`,
    eventDate(event.startsAt),
    "",
    `Gost: ${order.customerName}`,
    `Broj porudžbine: ${order.reference}`,
    `Broj ${many}: ${count}`,
    `Iznos: ${price(order.totalAmount)}`,
    "",
    `Vaše karte: ${orderUrl}`,
    "",
    ...urls.map((url, i) => `Karta ${i + 1}: ${url}`),
    "",
    "QR kod se prikazuje na stranici karte. Jedan kod — jedan ulaz.",
    `${site.street}, ${site.city} — ${site.phone}`,
  ].join("\n");

  return {
    to: order.customerEmail,
    subject: `Vaše Plitvice karte — ${event.title}`,
    html,
    text,
    replyTo: officeAddress(),
  };
}

/* ── a table ────────────────────────────────────────────────────────────── */

export function reservationMail(
  reservation: Reservation,
  night: { title: string; startsAt?: string },
  seatLabel: string,
): MailMessage {
  const when = night.startsAt ? eventDate(night.startsAt) : "";

  const html = shell(
    `Rezervacija potvrđena — ${night.title}`,
    `<tr><td style="padding:24px 28px 0 28px;">
      <h1 style="margin:0;font-size:22px;line-height:1.3;color:${INK};font-weight:400;">Rezervacija je potvrđena</h1>
      <p style="margin:10px 0 0 0;font-size:14px;color:${MUTED};">
        ${esc(night.title)}${when ? ` &middot; ${esc(when)}` : ""}
      </p>
    </td></tr>

    <tr><td style="padding:22px 28px 0 28px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
        ${row("Sto", seatLabel)}
        ${row("Gost", reservation.name)}
        ${row("Broj osoba", String(reservation.guests))}
        ${row("Broj rezervacije", reservation.id)}
      </table>
    </td></tr>

    <tr><td style="padding:22px 28px 26px 28px;">
      <p style="margin:0;font-size:13px;line-height:1.8;color:${MUTED};">
        Sto vas čeka do ponoći. Ako kasnite ili ne možete da dođete, javite nam
        na ${esc(site.phone)} da bismo ga oslobodili za nekoga drugog.
      </p>
    </td></tr>`,
  );

  const text = [
    `${site.name.toUpperCase()} — rezervacija je potvrđena`,
    night.title,
    when,
    "",
    `Sto: ${seatLabel}`,
    `Gost: ${reservation.name}`,
    `Broj osoba: ${reservation.guests}`,
    `Broj rezervacije: ${reservation.id}`,
    "",
    `Sto vas čeka do ponoći. Ako kasnite, javite nam na ${site.phone}.`,
    `${site.street}, ${site.city}`,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    to: reservation.email,
    subject: `Rezervacija potvrđena — ${night.title}`,
    html,
    text,
    replyTo: officeAddress(),
  };
}

/* ── and the note to the office ─────────────────────────────────────────── */

/* Plain, short, and everything staff need to ring the guest back without
   opening a screen. It goes to one address the club sets, and it carries a
   telephone number, which is exactly why it goes nowhere else. */
export function officeNoticeMail(
  reservation: Reservation,
  night: { title: string; startsAt?: string },
  seatLabel: string,
  to: string,
): MailMessage {
  const lines = [
    `${seatLabel} — ${reservation.guests} ${reservation.guests === 1 ? "osoba" : "osoba"}`,
    `${reservation.name} · ${reservation.phone}`,
    reservation.email ? reservation.email : "",
    reservation.note ? `Napomena: ${reservation.note}` : "",
    `Izvor: ${reservation.source === "phone" ? "telefon" : "sajt"} · status: ${reservation.status}`,
    `Broj: ${reservation.id}`,
  ].filter(Boolean);

  const html = shell(
    `Nova rezervacija — ${night.title}`,
    `<tr><td style="padding:24px 28px 26px 28px;">
      <h1 style="margin:0 0 14px 0;font-size:18px;color:${INK};font-weight:400;">
        Nova rezervacija — ${esc(night.title)}
      </h1>
      ${lines
        .map(
          (l) =>
            `<p style="margin:0 0 6px 0;font-size:14px;line-height:1.6;color:${INK};">${esc(l)}</p>`,
        )
        .join("")}
    </td></tr>`,
  );

  return {
    to,
    subject: `Nova rezervacija — ${seatLabel} — ${night.title}`,
    html,
    text: [`Nova rezervacija — ${night.title}`, "", ...lines].join("\n"),
  };
}
