/* WHAT THE PUBLIC SITE WOULD SHOW, PRINTED — a way to look at the join without
 * a browser. Reads the same environment the server does; writes nothing.
 *
 *   node scripts/programme-check.mjs
 *   node scripts/programme-check.mjs --env=.env.production-temp   */
import { register } from "node:module";
import { readFileSync } from "node:fs";

register("./resolve-alias.mjs", import.meta.url);

const arg = (n) => {
  const hit = process.argv.find((a) => a.startsWith(`--${n}=`));
  return hit ? hit.slice(n.length + 3) : undefined;
};
for (const file of [arg("env") ?? ".env.local", ".env"]) {
  let text = "";
  try {
    text = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
  } catch {
    continue;
  }
  for (const line of text.split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

const { programme } = await import("@/lib/club/programme");
const { allTicketingEvents } = await import("@/lib/ticketing/events");
const { closeDatabase } = await import("@/lib/db/client");

const rows = await allTicketingEvents();
console.log(`\n=== ${rows.length} rows in the events table ===`);
for (const r of rows) {
  console.log(
    `  ${r.slug.padEnd(22)} ${r.status.padEnd(8)} test=${r.testOnly ? "y" : "n"} ` +
      `arch=${r.archivedAt ? "y" : "n"} tickets=${r.ticketingEnabled ? "on " : "off"} ` +
      `tables=${r.tablesEnabled ? "on " : "off"} ${String(r.startsAt).slice(0, 10)}  ${r.title}`,
  );
}

const { upcoming, past, next } = await programme();
console.log(`\n=== public: ${upcoming.length} upcoming, ${past.length} past ===`);
console.log(`ZA KOJU ŽURKU? → ${upcoming.map((e) => `${e.artist} / ${e.date.sr}`).join(" · ") || "(nothing)"}`);

if (next) {
  console.log(`\n--- ${next.artist} ---`);
  console.log(`  slug        ${next.slug}`);
  console.log(`  date        ${next.date.sr}  /  ${next.date.en}`);
  console.log(`  startTime   ${next.startTime}`);
  console.log(`  poster      ${typeof next.poster === "string" ? next.poster : next.poster?.src}`);
  console.log(`  ambient     ${next.ambient}`);
  console.log(`  tickets     enabled=${next.tickets.enabled} sale=${next.tickets.sale}`);
  console.log(`  tables      enabled=${next.tables.enabled}`);
  console.log(`  price       ${next.ticketPrice}`);
  console.log(`  lineup      ${next.lineup}`);
  console.log(`  age         ${next.ageRestriction}`);
  console.log(`  entry       ${next.entryNote}`);
  console.log(`  promotion   ${next.promotion}`);
  console.log(`  description ${next.description}`);
}

console.log(`\n--- the record, in wall order ---`);
for (const e of past) console.log(`  ${e.date.sr.padEnd(14)} ${e.artist}`);

await closeDatabase();
