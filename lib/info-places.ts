import type { MessageKey } from "@/lib/i18n";

/* THE DIRECTORY BEHIND THE SIX CARDS — everything the old
 * plitviceclub.com/info pages carried, transcribed once, in one table.
 *
 * NOTHING HERE IS INVENTED. Every field is what the old pages actually said.
 * Where a page had no telephone number this has none either, and an absent
 * field renders as one fewer action rather than as a guess — which is why the
 * whole of `prva-pomoc` offers a map and nothing else, and why the pizzeria
 * does. A missing number is a smaller failure than a wrong one, and for a
 * clinic it is a very much smaller one.
 *
 * ANYTHING THAT HAS TO BE CHECKED IS MARKED `SUSPECT` OR `UNRESOLVED` and is
 * exactly why this is a table rather than six pages of markup: correcting one
 * is a single line here and nothing anywhere else.
 *
 * It lives beside lib/local-info.ts rather than inside it — that file is the
 * six categories and is read by the home page's pinned scene on every frame of
 * it; this is two hundred lines of addresses read by six pages. They are
 * joined by category id and by nothing else. */

/* ONE ENTRY IN A DIRECTORY.
 *
 * `name` and `address` are proper nouns and never go through the dictionary —
 * a street in Inđija is called what it is called in both languages, and so is
 * a bakery. Only `note`, which says what the place IS, is translated. */
export type Place = {
  name: string;
  address: string;
  /* Written the way it is said. Dialled by `dial()`, which keeps the digits
     and drops everything a human put in to make it readable. */
  phone?: string;
  /* What the place is, in the visitor's language. */
  note?: MessageKey;
  /* Hours exactly as the old page gave them: a literal, not copy, and the same
     in both languages. */
  hours?: string;
  /* Overrides what the map searches for.
   *
   * THE PIN IS THE POINT, so the rule is: leave this alone wherever Google
   * lists the business — the pin then carries its name, which is the strongest
   * thing a card can show. Set it where Google does not, because a business it
   * has never heard of returns no pin at all and the card shows an anonymous
   * piece of street. In order of preference: the address in comma form, which
   * always geocodes; the landmark the place sits in; and, where even the
   * address will not resolve, the town — see the UNRESOLVED notes below. */
  mapQuery?: string;
  /* Google's own id for the place, if one is ever verified. It makes the link
     out exact rather than a search that happens to land right, and it is the
     proper fix for anything marked UNRESOLVED: paste the id here and nothing
     else has to change. None of the entries below have one. */
  placeId?: string;
};

/* What each page says over its directory: the headline, in the two lines it
   was written as, and the sentence under it. Spelled out per slug rather than
   built from one — a template literal over a `string` slug widens back to
   `string`, and the whole value of MessageKey is that a key which is not in
   the dictionary does not compile. */
export const PAGE_COPY: Record<
  string,
  { a: MessageKey; b: MessageKey; lead: MessageKey }
> = {
  smestaj: {
    a: "info.page.smestaj.a",
    b: "info.page.smestaj.b",
    lead: "info.page.smestaj.lead",
  },
  restorani: {
    a: "info.page.restorani.a",
    b: "info.page.restorani.b",
    lead: "info.page.restorani.lead",
  },
  "non-stop": {
    a: "info.page.nonstop.a",
    b: "info.page.nonstop.b",
    lead: "info.page.nonstop.lead",
  },
  prevoz: {
    a: "info.page.prevoz.a",
    b: "info.page.prevoz.b",
    lead: "info.page.prevoz.lead",
  },
  "prva-pomoc": {
    a: "info.page.prva-pomoc.a",
    b: "info.page.prva-pomoc.b",
    lead: "info.page.prva-pomoc.lead",
  },
  "kako-do-nas": {
    a: "info.page.kako-do-nas.a",
    b: "info.page.kako-do-nas.b",
    lead: "info.page.kako-do-nas.lead",
  },
};

/* Keyed by category id — see INFO in lib/local-info.ts. The order inside each
   list is the order the page numbers them in. */
export const PLACES: Record<string, Place[]> = {
  smestaj: [
    {
      name: "Hotel Central",
      address: "Vojvode Stepe 2",
      phone: "+381 69 551 5511",
      note: "info.d.central",
      /* Google does not list the hotel; the address pins. */
      mapQuery: "Vojvode Stepe 2, Inđija",
    },
    {
      name: "Monogram Lux",
      address: "Novosadski put 2",
      phone: "+381 (0)69 140 04 04",
      note: "info.d.monogram",
    },
    {
      /* NOT the same place as "Monogram Lux" directly above, which is on
         Novosadski put in Inđija. This one is a hotel and restaurant at the
         Beščanski krst, in Maradik — a different village. The two share half a
         name and nothing else, and merging them would send anyone following
         the map link about ten kilometres out of town. */
      name: "Hotel MV Monogram",
      address: "Inđijska 3, Maradik",
      phone: "+381 62 400 404",
      note: "info.d.mvMonogram",
      /* The only entry in this table that is not in Inđija, so the town the
         default query appends would be the wrong one. */
      mapQuery: "Hotel MV Monogram Inđijska 3 Maradik",
    },
    {
      name: 'Apartmani "Kord 2"',
      address: "Trejdjunik 8",
      phone: "+381 (0)63 518 261",
      note: "info.d.kord2",
      /* The complex rather than the street: TQ Vegas is what Google lists and
         what the description already tells the reader to look for. */
      mapQuery: "TQ Vegas Inđija",
    },
  ],

  restorani: [
    {
      /* SUSPECT — this is the club's own number, digit for digit. Inherited
         from the old page as given; worth a call before it is trusted. */
      name: "Gotti",
      address: "Vojvode Stepe 6",
      phone: "+381 (0)69 606 050",
      note: "info.d.gotti",
    },
    {
      /* The old page carried +381 (0)00000000 against this one, which is a
         placeholder and not a telephone number. It is therefore not here, and
         the card offers the map alone. */
      name: 'Pizzeria "Galerija"',
      address: "Vojvode Stepe 2",
      note: "info.d.galerija",
      mapQuery: "Pizzeria Galerija Vojvode Stepe 2 Inđija",
    },
    {
      name: "Corso",
      address: "Vojvode Stepe 1",
      phone: "+381 (0)22 559 000",
      note: "info.d.corso",
    },
    {
      name: "Perla",
      address: "Dušana Jerkovića 9",
      phone: "+381 (0)22 565 397",
      note: "info.d.perla",
    },
    {
      /* INCOMPLETE — the street, the telephone number and a line about the
         place are all still to come; nothing here is guessed at. The card
         renders on the name and the town alone, which is what the absent
         fields are for, and the map is asked for the business by name. Fill
         `address`, `phone` and `note` in and each appears by itself. */
      name: "Nest",
      address: "Inđija",
      mapQuery: "Nest Inđija",
    },
  ],

  nonstop: [
    {
      name: "NIS Petrol",
      address: "Kralja Petra I bb",
      phone: "0800 008888",
      hours: "00—24",
      mapQuery: "NIS Petrol Kralja Petra I Inđija",
    },
    {
      /* SUSPECT — the old page gives the club's own number here as well. Left
         exactly as it was found and isolated to this one line, so that
         correcting it is a one-line change. */
      name: 'STR "Željana"',
      address: 'TC "Sloboda", lokal 13',
      phone: "+381 (0)69 606 050",
      hours: "00—24",
      mapQuery: "TC Sloboda Inđija",
    },
    {
      name: "Skroz dobra pekara",
      address: "Novosadski put 2a",
      hours: "00—24",
      note: "info.d.pekara",
    },
  ],

  prevoz: [
    {
      name: "Železnička stanica — Inđija",
      address: "Železnička bb",
      phone: "+381 (0)22 560 866",
      note: "info.d.zeleznicka",
      mapQuery: "Železnička stanica Inđija",
    },
    {
      name: "Autobuska stanica — Inđija",
      address: "Sonje Marinković bb",
      phone: "+381 (0)22 561 409",
      note: "info.d.autobuska",
      mapQuery: "Autobuska stanica Inđija",
    },
    {
      name: "Aerodrom Nikola Tesla",
      address: "Surčin — Beograd",
      phone: "+381 (0)11 209 4444",
      note: "info.d.aerodrom",
      mapQuery: "Aerodrom Nikola Tesla Beograd",
    },
    {
      name: "Taxi stanica — Inđija",
      address: "Kralja Petra I bb",
      phone: "+381 (0)22 554 154",
      hours: "00—24",
      note: "info.d.taxi",
      /* UNRESOLVED — "Kralja Petra I bb" will not geocode inside Inđija. The
         plain address matches the Kralja Petra I in Beška, ten kilometres up
         the road; the same street with the postcode lands there too, its
         formal "Ulica" form lands on an industrial estate, and the name with
         the street lands on open country. Rather than pin somewhere the taxi
         rank is not, the map is held on the town and the street is left to the
         line of text above it. A verified placeId makes this exact. */
      mapQuery: "Inđija",
    },
    {
      name: 'Rent a car "Inđija 022"',
      address: "Kralja Petra I bb",
      phone: "+381 (0)64 966 10 00",
      /* UNRESOLVED — same street, same problem. See the note above. */
      mapQuery: "Inđija",
    },
    {
      name: 'Rent a car "29"',
      address: "Vojvode Stepe 29",
      phone: "+381 (0)65 26 26 269",
      mapQuery: "Vojvode Stepe 29 Inđija",
    },
    {
      name: 'Rent a car "Heri In"',
      address: "Kordunaška 43",
      phone: "+381 (0)64 48 000 06",
      mapQuery: "Kordunaška 43 Inđija",
    },
  ],

  /* THE ONE CATEGORY WITH NO TELEPHONE NUMBERS IN IT. The old page carried
     none for any of these four, and an emergency number is the last thing on
     a website to guess at, so every card here offers the map and nothing else.
     Add a verified `phone` to a line and its POZOVI appears by itself. */
  "prva-pomoc": [
    {
      name: 'Dom zdravlja "Dr Milorad-Mika Pavlović"',
      address: "Srpskocrkvena 5",
      note: "info.d.domZdravlja",
      mapQuery: "Dom zdravlja Dr Milorad Mika Pavlović Inđija",
    },
    {
      name: "Julija Farm",
      address: "Novosadski put 8",
      note: "info.d.apoteka",
      mapQuery: "Apoteka Julija Farm Novosadski put Inđija",
    },
    {
      name: "Lilly apoteka",
      address: "Kralja Petra I 5",
      note: "info.d.apoteka",
      mapQuery: "Lilly apoteka Kralja Petra I Inđija",
    },
    {
      name: "BENU",
      address: "Novosadski put 23",
      note: "info.d.apoteka",
      mapQuery: "BENU apoteka Novosadski put Inđija",
    },
  ],
};

/* A number, as a telephone actually dials it.
 *
 * THE BRACKETED ZERO IS NOT A DIGIT. Serbian numbers are written +381 (0)69
 * 606 050: the zero in brackets is the trunk prefix, and it is there to be
 * used INSTEAD of the country code when dialling inside the country, never as
 * well as it. Stripping the brackets and keeping the zero — which is what
 * removing every non-digit does — produces +381069606050, which is not a
 * number anywhere. So the group goes first, and only then the punctuation.
 *
 * A number written without a country code is left as it is: 0800 008888 is
 * dialled exactly like that from inside Serbia, which is the only place it
 * works from at all. */
export function dial(phone: string) {
  const international = phone.startsWith("+");
  const digits = (international ? phone.replace(/\(0\)/g, "") : phone).replace(
    /[^\d]/g,
    "",
  );

  return `tel:${international ? "+" : ""}${digits}`;
}

/* WHAT GOOGLE IS ASKED FOR. The place by the name it knows where there is one,
   by address otherwise, and the town is always in the query — half these
   streets exist in every town in Serbia. The quotation marks a sign carries
   are dropped: they are typography, and a search engine reads them as a
   phrase. */
function placeQuery(place: Place) {
  return (
    place.mapQuery ??
    `${place.name} ${place.address} Inđija`.replace(/["„”]/g, "")
  );
}

/* Where the map opens. `placeId` is the exact answer where we have one and the
   query is only the label beside it; without one the query is the whole of it.
   Both forms are keyless. */
export function placeMap(place: Place) {
  const query = encodeURIComponent(placeQuery(place));

  return place.placeId
    ? `https://www.google.com/maps/search/?api=1&query=${query}&query_place_id=${place.placeId}`
    : `https://maps.google.com/?q=${query}`;
}

/* And the map shown in the card.
 *
 * Google's own keyless embed — no API key, no billing account and no script on
 * the page, just an iframe that draws the roads and drops a pin on what the
 * query resolved to. The same one the club's own map on the home page is drawn
 * with; see mapsEmbedUrl in lib/site.ts.
 *
 * Zoom 16 rather than 17: a card is a window into WHERE a place is, and one
 * notch further out is the difference between a pin in a grey field and a pin
 * with the streets around it.
 *
 * NOTE ON placeId — the keyless embed cannot take one. Google's Embed API can
 * (`/maps/embed/v1/place?q=place_id:…`) but wants a key and a billing account
 * for it, which this site does not have and does not need. The id is used on
 * the way OUT, where it is keyless and exact — see placeMap above. */
export function placeEmbed(place: Place, lang: string) {
  const query = encodeURIComponent(placeQuery(place));

  return `https://maps.google.com/maps?q=${query}&hl=${mapLang(lang)}&t=&z=16&ie=UTF8&iwloc=&output=embed`;
}

/* WHICH SERBIAN. Google reads plain `sr` as Cyrillic and hands back Југ
   Богдана where every other word on this site says Jug Bogdana — one map with
   a different alphabet on it is the loudest thing on the page. `sr-Latn` is
   the same language in the script the site is set in. */
function mapLang(lang: string) {
  return lang === "sr" ? "sr-Latn" : lang;
}

/* The club itself, shaped like a Place so that every map on these six pages is
   drawn by one helper — see the house's own window in
   components/local-info/info-route.tsx. */
export const HOUSE: Place = {
  name: "Plitvice",
  address: "Cara Dušana 14",
  mapQuery: "Plitvice Club Cara Dušana 14 Inđija",
};

/* THE ROAD IN, for the one page that is not a directory. Three ways to arrive
   and a line about each. Nothing here is a timetable and nothing links out to
   one: the old page had none, and inventing an operator's URL is worse than
   leaving the reader to search for it. */
export const ROUTES = [
  { id: "car", name: "info.route.car", note: "info.route.carNote" },
  { id: "train", name: "info.route.train", note: "info.route.trainNote" },
  { id: "plane", name: "info.route.plane", note: "info.route.planeNote" },
] as const satisfies readonly {
  id: string;
  name: MessageKey;
  note: MessageKey;
}[];
