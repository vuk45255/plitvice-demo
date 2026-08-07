export const languages = ["sr", "en"] as const;
export type Lang = (typeof languages)[number];

export const LANG_STORAGE_KEY = "plitvice-lang";

/* Every word the visitor reads lives here.

   An asterisk pair marks the word a heading sets in italic — "Tvoj *sto*."
   The renderer in the language provider turns it into <em>, which keeps JSX
   out of the dictionary and lets a translator move the emphasis to wherever it
   falls naturally in their language.

   The house mark itself (GRAND CLUB / PLITVICE / INĐIJA) is a name, not copy,
   and is never translated. */
const sr = {
  "nav.events": "Događaji",
  "nav.parties": "Naše žurke",
  "nav.about": "O nama",
  "nav.reserve": "Rezervacija",

  "common.reserve": "Rezervacija",
  "common.reserveTable": "Rezerviši sto",
  "common.openMenu": "Otvori meni",
  "common.closeReservation": "Zatvori rezervaciju",
  "common.closeMenu": "Zatvori meni",
  "common.skip": "Preskoči na sadržaj",
  "common.toTop": "na vrh strane",
  "common.language": "Jezik",
  "common.openInstagram": "otvori Instagram",

  "hero.scroll": "Skroluj da uđeš",
  "hero.heading": "Plitvice — Grand Club, Inđija",

  "events.title": "Naši *događaji*.",
  "events.next": "Naredna žurka",
  "events.past": "Prošli događaji",
  "events.more": "Saznaj više",
  "events.passed": "Prošlo",
  "events.featuredDate": "15. avgust",
  "events.featuredAlt": "Najava naredne žurke u klubu Plitvice",
  "events.pastAlt": "Fotografija sa prošle žurke u klubu Plitvice",

  "gallery.title": "Naše *žurke*.",
  "gallery.caption": "Svake subote",
  "gallery.cta": "Pogledaj na Instagram",
  "gallery.alt.1": "Puna sala pred nastup",
  "gallery.alt.2": "Nastup uživo pod reflektorima",
  "gallery.alt.3": "Publika u prvim redovima",
  "gallery.alt.4": "Bina i svetla usred večeri",
  "gallery.alt.5": "Ruke u vazduhu pred binom",
  "gallery.alt.6": "Topli odsjaj nad podijumom",
  "gallery.alt.7": "Poslednji set pred jutro",
  "gallery.alt.8": "Noć u punom zamahu",

  "interlude.top": "Plitvice",
  "interlude.title": "Od 1965 sa vama",
  "interlude.bottom": "Ista energija · Nova generacija",

  "about.title": "Mi nismo samo *klub*.",
  "about.p1": "Od 1965. godine priča o Plitvicama traje kroz generacije.",
  "about.p2":
    "Ista sala pamti šezdesete, devedesete i sinoć. Menjali su se zvuk, gosti i povodi — ostalo je mesto na koje se dolazi kad noć treba da znači nešto.",
  "about.p3a": "Godine se smenjuju.",
  "about.p3b": "Ime ostaje isto.",
  "about.caption": "Plitvice · od 1965.",
  "about.videoAlt": "Snimci iz kluba Plitvice kroz generacije",

  "about.story1":
    "Plitvice nisu nastale preko noći. Kroz decenije su postale mesto gde se spajaju generacije, muzika i uspomene.",
  "about.story2":
    "Od prvih večeri kada su se stvarale prve priče, do današnjih noći ispunjenih novom energijom — ideja je ostala ista: napraviti prostor zbog kog ljudi dolaze, vraćaju se i pamte trenutke.",
  "about.story3":
    "Kroz godine menjali su se trendovi, muzika i generacije gostiju, ali ono najvažnije nije promenjeno — osećaj da si na pravom mestu u pravom trenutku.",
  "about.story4":
    "Plitvice su mesto gde počinje vikend, gde se slave posebni trenuci i gde obična noć može postati uspomena.",
  "about.story5":
    "Danas klub spaja tradiciju sa novom energijom. Moderna produkcija, pažljivo birana muzika i atmosfera koja se gradi zajedno sa ljudima koji dolaze čine da Plitvice ostanu deo noćnog života Inđije i okoline.",

  "vip.title": "Tvoj *sto*.",
  "vip.p1": "Mesto za noći koje se pamte.",
  "vip.p2": "Vi okupite ekipu, ostalo prepustite nama.",
  "vip.hoverText": "Rezerviši svoje mesto za sledeću subotu.",
  "vip.imgAlt": "Rezervisan sto iznad podijuma, spreman pred otvaranje",

  "location.title": "*Pronađite* nas.",
  "location.caption": "Svake subote",
  "location.address": "Adresa",
  "location.hours": "Radno vreme",
  "location.social": "Društvene mreže",
  "location.maps": "Otvori u Google mapama",
  "location.mapAria": "Otvori lokaciju kluba Plitvice u Google mapama",
  "location.imgAlt": "Ulaz u klub Plitvice u Inđiji",

  "hours.saturday": "Subota",
  "hours.time": "22:00 — Poslednji gost",

  /* Deliberately the same word in both languages — it reads as a label, the
     way the backdrop words do. */
  "footer.contact": "Social",
  "footer.hours": "Radno vreme",
  "footer.location": "Lokacija",
  "footer.maps": "Google mape",
  "footer.rights": "© 2026 Plitvice. Sva prava zadržana.",
  /* A studio credit — the name stays as written in both languages. */
  "footer.credit": "Powered by VAntage",

  "feed.title": "Zapratite nas!",
  "feed.watch": "Pogledaj snimak",
  "feed.photo.1": "Nastup pod punim svetlima",
  "feed.photo.2": "Separe iznad podijuma",
  "feed.photo.3": "Detalj noći na šanku",
  "feed.reel.1": "Podijum u punom zamahu",
  "feed.reel.2": "Sala usred seta",
  "feed.reel.3": "DJ pult pred vrhunac večeri",

  /* The reservation room. Copy is the doorman's, not a contact form's. */
  "reserve.title": "Rezervacija",
  "reserve.lead1": "Mesto za noći koje se pamte.",
  "reserve.lead2": "Vi okupite ekipu, ostalo prepustite nama.",
  "reserve.name": "Ime i prezime",
  "reserve.phone": "Broj telefona",
  "reserve.email": "Email",
  "reserve.guests": "Broj osoba",
  "reserve.date": "Datum rezervacije",
  "reserve.time": "Vreme dolaska",
  "reserve.note": "Napomena / posebni zahtevi",
  "reserve.noteHint": "Rođendan, mesto u sali, flaša na stolu — recite nam.",
  "reserve.optional": "opciono",
  "reserve.submit": "Pošalji rezervaciju",
  "reserve.sending": "Šaljemo…",
  "reserve.footnote":
    "Potvrdu javljamo telefonom ili mejlom, najčešće istog dana.",
  "reserve.successTitle": "Vaša rezervacija je poslata.",
  "reserve.successBody": "Javićemo vam se uskoro.",
  "reserve.successAgain": "Nova rezervacija",
  "reserve.back": "Nazad na sajt",

  "reserve.err.name": "Upišite ime i prezime.",
  "reserve.err.phone": "Upišite ispravan broj telefona.",
  "reserve.err.email": "Upišite ispravnu email adresu.",
  "reserve.err.guests": "Broj osoba mora biti između 1 i 50.",
  "reserve.err.date": "Izaberite datum — današnji ili kasniji.",
  "reserve.err.time": "Izaberite vreme dolaska.",
  "reserve.err.summary": "Proverite označena polja.",
} as const;

export type MessageKey = keyof typeof sr;

const en: Record<MessageKey, string> = {
  "nav.events": "Events",
  "nav.parties": "Our parties",
  "nav.about": "About us",
  "nav.reserve": "Reservations",

  "common.reserve": "Reserve",
  "common.reserveTable": "Book a table",
  "common.openMenu": "Open menu",
  "common.closeReservation": "Close reservation",
  "common.closeMenu": "Close menu",
  "common.skip": "Skip to content",
  "common.toTop": "back to top",
  "common.language": "Language",
  "common.openInstagram": "open Instagram",

  "hero.scroll": "Scroll to enter",
  "hero.heading": "Plitvice — Grand Club, Inđija",

  "events.title": "Our *nights*.",
  "events.next": "Next party",
  "events.past": "Past events",
  "events.more": "Find out more",
  "events.passed": "Past",
  "events.featuredDate": "15 August",
  "events.featuredAlt": "Announcement of the next party at Plitvice club",
  "events.pastAlt": "Photograph from a past party at Plitvice club",

  "gallery.title": "Our *parties*.",
  "gallery.caption": "Every Saturday",
  "gallery.cta": "See it on Instagram",
  "gallery.alt.1": "A full room before the show",
  "gallery.alt.2": "Live on stage under the lights",
  "gallery.alt.3": "The crowd in the front rows",
  "gallery.alt.4": "Stage and lights mid-evening",
  "gallery.alt.5": "Hands in the air at the stage",
  "gallery.alt.6": "Warm glow over the dance floor",
  "gallery.alt.7": "The last set before morning",
  "gallery.alt.8": "The night in full swing",

  "interlude.top": "Plitvice",
  "interlude.title": "With you since 1965",
  "interlude.bottom": "Same energy · New generation",

  "about.title": "We are more than a *club*.",
  "about.p1": "Since 1965, the story of Plitvice has run through generations.",
  "about.p2":
    "The same room remembers the sixties, the nineties and last night. The sound, the crowd and the occasions changed — what stayed is the place you come to when a night is meant to mean something.",
  "about.p3a": "The years keep turning.",
  "about.p3b": "The name stays the same.",
  "about.caption": "Plitvice · since 1965",
  "about.videoAlt": "Footage from Plitvice club across the generations",

  "about.story1":
    "Plitvice was not built overnight. Over the decades it became the place where generations, music and memories meet.",
  "about.story2":
    "From the first evenings, when the first stories were made, to tonight's rooms full of new energy — the idea has not changed: build a place people come to, come back to, and remember.",
  "about.story3":
    "Trends changed, the music changed, the crowd changed. What did not is the feeling of being in the right place at the right moment.",
  "about.story4":
    "Plitvice is where the weekend starts, where the occasions worth marking are celebrated, and where an ordinary night can turn into a memory.",
  "about.story5":
    "Today the club holds its tradition alongside a new energy. Modern production, carefully chosen music and a room built together with the people in it keep Plitvice part of the nightlife of Inđija and everything around it.",

  "vip.title": "Your *table*.",
  "vip.p1": "A place for nights worth remembering.",
  "vip.p2": "You gather the crew, leave the rest to us.",
  "vip.hoverText": "Book your place for this Saturday.",
  "vip.imgAlt": "A reserved table above the dance floor, set before opening",

  "location.title": "*Find* us.",
  "location.caption": "Every Saturday",
  "location.address": "Address",
  "location.hours": "Opening hours",
  "location.social": "Social",
  "location.maps": "Open in Google Maps",
  "location.mapAria": "Open the location of Plitvice club in Google Maps",
  "location.imgAlt": "The entrance to Plitvice club in Inđija",

  "hours.saturday": "Saturday",
  "hours.time": "22:00 — Last guest",

  "footer.contact": "Social",
  "footer.hours": "Opening hours",
  "footer.location": "Location",
  "footer.maps": "Google Maps",
  "footer.rights": "© 2026 Plitvice. All rights reserved.",
  "footer.credit": "Powered by VAntage",

  "feed.title": "Follow us!",
  "feed.watch": "Watch the clip",
  "feed.photo.1": "On stage under full lights",
  "feed.photo.2": "The booth above the dance floor",
  "feed.photo.3": "A detail of the night at the bar",
  "feed.reel.1": "The dance floor in full swing",
  "feed.reel.2": "The room mid-set",
  "feed.reel.3": "The booth before the peak of the night",

  "reserve.title": "Reservations",
  "reserve.lead1": "A place for nights worth remembering.",
  "reserve.lead2": "You gather the crew, leave the rest to us.",
  "reserve.name": "Full name",
  "reserve.phone": "Phone number",
  "reserve.email": "Email",
  "reserve.guests": "Number of guests",
  "reserve.date": "Date",
  "reserve.time": "Arrival time",
  "reserve.note": "Note / special requests",
  "reserve.noteHint": "A birthday, a spot in the room, a bottle on the table — tell us.",
  "reserve.optional": "optional",
  "reserve.submit": "Send reservation",
  "reserve.sending": "Sending…",
  "reserve.footnote": "We confirm by phone or email, usually the same day.",
  "reserve.successTitle": "Your reservation has been sent.",
  "reserve.successBody": "We will get back to you shortly.",
  "reserve.successAgain": "New reservation",
  "reserve.back": "Back to the site",

  "reserve.err.name": "Please enter your full name.",
  "reserve.err.phone": "Please enter a valid phone number.",
  "reserve.err.email": "Please enter a valid email address.",
  "reserve.err.guests": "The number of guests must be between 1 and 50.",
  "reserve.err.date": "Choose a date — today or later.",
  "reserve.err.time": "Choose your arrival time.",
  "reserve.err.summary": "Please check the marked fields.",
};

export const messages: Record<Lang, Record<MessageKey, string>> = { sr, en };
