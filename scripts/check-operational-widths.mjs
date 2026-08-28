/* NO HORIZONTAL OVERFLOW ON A PHONE — checked rather than assumed.
 *
 *   npm run dev            (in one terminal)
 *   node scripts/check-operational-widths.mjs
 *
 * The four widths are the ones the club's own phones actually are: 375 is an
 * iPhone SE and a Mini, 390 an iPhone 12–15, 404 a Pixel, 430 a Pro Max. A
 * doorman scrolling sideways to find a button is a doorman who misses it.
 *
 * It measures the DOCUMENT rather than looking at a screenshot: an element
 * wider than the viewport is a fact, and `scrollWidth > clientWidth` is that
 * fact. When something does overflow, it names the widest offending element so
 * there is somewhere to go — a table that is meant to scroll inside its own
 * box is fine, and one that pushes the page is not.
 *
 * Only the OPERATIONAL pages. The public site is a different design with its
 * own rules and is deliberately not touched by this. */

import puppeteer from "puppeteer-core";

const BASE = (process.argv[2] ?? "http://localhost:3000").replace(/\/+$/, "");
const WIDTHS = [375, 390, 404, 430];

const CHROME =
  process.env.CHROME_PATH ??
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

/* One of each kind of operational page. The two that take a parameter are
   filled in from a real order created on the way past, so the ticket page is
   measured with a real QR in it rather than as a 404. */
async function paths() {
  const checkout = await fetch(`${BASE}/api/ticketing/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      eventSlug: "test-night",
      quantity: 4,
      buyer: {
        name: "Provera Širine",
        email: `width-${Date.now()}@example.com`,
        phone: "069 60 60 50",
      },
    }),
  }).then((r) => r.json());

  if (!checkout.ok) {
    throw new Error(
      `could not create a test order (${checkout.reason ?? "?"}). Is the dev ` +
        "server running with TICKETING_DEV_MODE=true, and is the test night still open?",
    );
  }

  await fetch(`${BASE}/api/ticketing/dev/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ order: checkout.order }),
  });

  const orderPage = await fetch(`${BASE}/karte/${checkout.order}`).then((r) => r.text());
  const token = orderPage.match(/href="\/t\/([A-Za-z0-9_-]+)"/)?.[1];
  if (!token) throw new Error("the order page listed no tickets");

  return [
    "/osoblje",
    "/scanner",
    "/admin",
    "/admin/karte",
    "/admin/plan",
    "/admin/dogadjaji",
    "/admin/rezervacije",
    `/karte/${checkout.order}`,
    `/t/${token}`,
    "/dev/ticketing",
  ];
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox"],
});

let failures = 0;

try {
  const pages = await paths();
  const page = await browser.newPage();

  for (const path of pages) {
    for (const width of WIDTHS) {
      await page.setViewport({ width, height: 800, deviceScaleFactor: 2 });
      await page.goto(`${BASE}${path}`, { waitUntil: "networkidle0", timeout: 30_000 });

      const verdict = await page.evaluate(() => {
        const doc = document.documentElement;
        const overflow = doc.scrollWidth - doc.clientWidth;
        if (overflow <= 0) return { overflow: 0, culprit: null };

        /* Whatever sticks out furthest past the right edge, and is not inside
           something that is allowed to scroll on its own. */
        let worst = null;
        for (const element of document.querySelectorAll("body *")) {
          const box = element.getBoundingClientRect();
          if (box.right <= doc.clientWidth + 1) continue;

          let scrollable = false;
          for (let parent = element.parentElement; parent; parent = parent.parentElement) {
            const style = getComputedStyle(parent);
            if (style.overflowX === "auto" || style.overflowX === "scroll") {
              scrollable = true;
              break;
            }
          }
          if (scrollable) continue;

          if (!worst || box.right > worst.right) {
            worst = {
              right: box.right,
              tag: element.tagName.toLowerCase(),
              cls: String(element.className).slice(0, 90),
            };
          }
        }
        return { overflow, culprit: worst };
      });

      if (verdict.overflow > 0 && verdict.culprit) {
        failures += 1;
        console.log(
          `  ✗ ${width}px  ${path}  overflows by ${verdict.overflow}px — ` +
            `<${verdict.culprit.tag} class="${verdict.culprit.cls}">`,
        );
      } else if (verdict.overflow > 0) {
        /* Something scrolls sideways inside its own box, which is what a wide
           table is supposed to do. Not a failure. */
        console.log(`  · ${width}px  ${path}  (inner scroller only)`);
      } else {
        console.log(`  ✓ ${width}px  ${path}`);
      }
    }
  }
} finally {
  await browser.close();
}

console.log(
  failures === 0
    ? "\n  ✓ no horizontal overflow at 375, 390, 404 or 430."
    : `\n  ✗ ${failures} overflowing view(s).`,
);
process.exit(failures === 0 ? 0 : 1);
