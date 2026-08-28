import QRCode from "qrcode";

/* The code itself.
 *
 * Rendered on the SERVER, as SVG, into the page. Not a script in the browser,
 * not an <img> pointing at an endpoint, not a canvas: a QR code is a fixed
 * picture of a fixed string, and the guest holding the phone at the door
 * should not be waiting on JavaScript, a network request or a font to be able
 * to get in. It is in the HTML, so it is on the screen as soon as the page is.
 *
 * ═══ WHAT IS IN IT ════════════════════════════════════════════════════════
 *
 * One URL, and inside it one opaque token. NOTHING ELSE — no name, no email,
 * no telephone number, no price, no order number. A ticket gets photographed,
 * posted, screenshotted and left on tables; everything encoded in it is public
 * the moment it is printed, so the only thing in it is a string that means
 * nothing to anybody who cannot ask this server about it.
 *
 * ═══ WHY IT LOOKS LIKE A QR CODE AND NOT LIKE ANYTHING ELSE ═══════════════
 *
 * Black on white, square modules, four modules of quiet zone, no logo in the
 * middle, no gradient, no rounded corners, no gold. Everything on this page
 * except this one rectangle carries the club's hand — and this rectangle is a
 * machine-readable object whose whole job is to be read on the first try, in a
 * doorway, at night, off a scratched screen at whatever brightness the guest's
 * phone happens to be at. Every decorative liberty taken with a QR code is
 * paid for in scans that fail, and a failed scan is a queue.
 *
 * The white ground is drawn deliberately rather than inherited: the ticket is
 * dark, and a QR on a dark ground with an inverted palette is a QR that a
 * meaningful share of camera apps will not read at all.
 *
 * ERROR CORRECTION M — about 15% recoverable. Q and H buy tolerance for damage
 * that a screen does not suffer, and pay for it in denser modules; M on a
 * seventy-character URL gives a 33-module code, which at the size the ticket
 * page sets means fat, high-contrast squares. That is the trade that scans
 * fastest. */

export type QrOptions = {
  /* Passed to the <svg>, so the page decides how big it is. */
  className?: string;
  /* What a screen reader says. Never the token. */
  title?: string;
};

export async function qrSvg(text: string, options: QrOptions = {}): Promise<string> {
  const svg = await QRCode.toString(text, {
    type: "svg",
    errorCorrectionLevel: "M",
    /* Four modules, which is the specification's minimum quiet zone. Less
       than this and scanners start missing the finder patterns against a
       busy background. */
    margin: 4,
    color: { dark: "#000000", light: "#ffffff" },
  });

  /* The library emits a bare <svg viewBox=…> with no width or height, which
     is what we want — it takes the size of whatever contains it. All that is
     added here is the class and the accessible name. */
  const title = options.title ? escapeXml(options.title) : null;
  const attrs = [
    options.className ? `class="${escapeXml(options.className)}"` : "",
    title ? `role="img" aria-label="${title}"` : `role="img"`,
  ]
    .filter(Boolean)
    .join(" ");

  return svg.replace("<svg ", `<svg ${attrs} `);
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
