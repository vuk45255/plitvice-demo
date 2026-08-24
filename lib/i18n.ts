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
  "nav.gallery": "Galerija",
  "nav.about": "O nama",
  /* The phone's menu carries one door the wide bar does not — see
     components/site-header-mobile.tsx. */
  "nav.location": "Lokacija",
  "nav.reserve": "Rezervacija",

  "common.reserve": "Rezervacija",
  "common.reserveTable": "Rezerviši sto",
  "common.openMenu": "Otvori meni",
  "common.closeMenu": "Zatvori meni",
  /* The two words written on the controls themselves, on a phone. The pair
     above stays where it is: those are what a screen reader announces. */
  "common.menu": "Meni",
  "common.close": "Zatvori",
  "common.skip": "Preskoči na sadržaj",
  "common.toTop": "na vrh strane",
  "common.language": "Jezik",
  "common.openInstagram": "otvori Instagram",
  "common.back": "Nazad na sajt",

  "hero.scroll": "Skroluj da uđeš",
  "hero.heading": "Plitvice — Grand Club, Inđija",

  "events.title": "Naši *događaji*.",
  "events.next": "Naredna žurka",
  "events.past": "Prošli događaji",
  "events.buy": "Kupi kartu",
  "events.none": "Trenutno nema najavljene žurke.",
  /* Under the night ahead, when the doors close; and the one word under a
     night that has already happened. */
  "events.lastGuest": "Poslednji gost",
  "events.archived": "Prošlo",

  /* The two facts that stand under the date of a night. */
  "event.doors": "Početak",
  "event.ticket": "Karta",
  /* The label on the number under the poster. The number itself lives in
     lib/site.ts — it is the same in every language. */
  "event.info": "Info",

  /* What a night says for itself, set under its poster. One key per night. */
  "event.about.vodkaExperience":
    "Vodka Experience by Plitvice. Music by Dave Pavlo, posebna atmosfera i boca vodke gratis za ekipe koje stignu do ponoći. Minimalno 4 gosta za barski sto, 4–5 za visoki sto i 6 za separe. Ulaz 16+ uz lični dokument.",

  "gallery.title": "Naše *žurke*.",
  "gallery.caption": "Svake subote",
  "gallery.cta": "Pogledaj na Instagram",

  /* The three windows on the home page, and the rooms behind them. */
  "portals.heading": "Tri prozora u svet Plitvica",
  "portals.atmosfera": "Atmosfera",
  "portals.zurke": "Žurke",
  "portals.trenutci": "Trenutci",

  /* THE CONCIERGE — the six things a visitor coming into Inđija for the night
     actually has to solve. The order is lib/local-info.ts; these are only the
     words. Each category is written twice: the name over the card, and the
     word the pinned intro asks its question with, which is not always the same
     one — a card says RESTORANI, the question asks RESTORAN? */
  "info.heading": "Korisne informacije za Inđiju",
  "info.asking": "Treba vam",

  "info.smestaj": "Smeštaj",
  "info.restorani": "Restorani",
  "info.nonstop": "Non-stop shop",
  "info.prevoz": "Prevoz",
  "info.prvaPomoc": "Prva pomoć",
  "info.kakoDoNas": "Kako do nas",

  "info.ask.smestaj": "Smeštaj",
  "info.ask.restorani": "Restoran",
  "info.ask.nonstop": "Non-stop shop",
  "info.ask.prevoz": "Prevoz",
  "info.ask.prvaPomoc": "Prva pomoć",
  "info.ask.kakoDoNas": "Kako do nas",

  /* Alt text for the six photographs. Written to work read aloud. */
  "info.alt.smestaj": "Soba u hotelu u Inđiji, spremljena za noćenje",
  "info.alt.restorani": "Postavljen sto u restoranu u Inđiji",
  "info.alt.nonstop": "Osvetljena non-stop prodavnica noću",
  "info.alt.prevoz": "Taksi na ulici Inđije posle ponoći",
  "info.alt.prvaPomoc": "Ulaz u dežurnu ambulantu",
  "info.alt.kakoDoNas": "Put ka Inđiji noću",

  /* The word under a card that leads somewhere. */
  "info.discover": "Pogledaj",

  /* The way back out of the guide, set beside the rail over the grid. */
  "info.restart": "Na početak",

  /* ─────────── THE SIX PAGES BEHIND THE CARDS — /info/<slug> ───────────
     The rail over every one of them, the way back to the six, and the two
     things a row can offer. What each place IS lives under info.d.* below;
     its name and its address are proper nouns and are not in here. */
  "info.page.eyebrow": "Info",
  "info.page.back": "Info",
  "info.action.call": "Pozovi",
  "info.action.openMap": "Otvori mapu",

  /* Two lines each: the headline breaks where it is written to break. */
  "info.page.smestaj.a": "Smeštaj",
  "info.page.smestaj.b": "u Inđiji.",
  "info.page.smestaj.lead": "Predlog smeštaja za goste Plitvica.",
  "info.page.restorani.a": "Restorani",
  "info.page.restorani.b": "u Inđiji.",
  "info.page.restorani.lead": "Gde na večeru pre ili posle Plitvica.",
  "info.page.nonstop.a": "Otvoreno",
  "info.page.nonstop.b": "00—24.",
  "info.page.nonstop.lead": "Kad vam nešto zatreba posle ponoći.",
  "info.page.prevoz.a": "Prevoz",
  "info.page.prevoz.b": "u Inđiji.",
  "info.page.prevoz.lead": "Sve što vam treba da stignete i vratite se.",
  "info.page.prva-pomoc.a": "Prva pomoć",
  "info.page.prva-pomoc.b": "u Inđiji.",
  "info.page.prva-pomoc.lead": "Dežurna služba i apoteke u Inđiji.",
  "info.page.kako-do-nas.a": "Kako",
  "info.page.kako-do-nas.b": "do nas.",
  "info.page.kako-do-nas.lead":
    "Inđija je na sat vremena od Beograda i pola sata od Novog Sada.",

  /* WHAT EACH PLACE IS. One line, never a review — see lib/info-places.ts. */
  "info.d.central": "Moderan hotel u samom centru Inđije.",
  "info.d.inClub": "Prenoćište i doručak u Inđiji.",
  "info.d.mvMonogram":
    "Hotel i restoran na Beščanskom krstu, u mirnijem okruženju nadomak Inđije.",
  "info.d.kord2": "Apartmani u centru Inđije, u okviru kompleksa TQ Vegas.",
  "info.d.monogram": "Smeštaj u mirnijem delu Inđije, u blizini parka i jezera.",
  "info.d.perlaLux": "Apartmani u centru Inđije.",
  "info.d.galerija":
    "Pizzeria u centru Inđije sa ponudom pizza i italijanske kuhinje.",
  "info.d.gotti":
    "Restoran u centru Inđije sa tradicionalnom i internacionalnom kuhinjom.",
  "info.d.corso": "Restoran-pizzeria u centru Inđije.",
  "info.d.perla": "Tradicionalna i internacionalna kuhinja.",
  "info.d.pekara": "Pekara sa slanim i slatkim pecivima.",
  "info.d.zeleznicka": "Stanica se nalazi u širem centru Inđije.",
  "info.d.autobuska": "Autobuska stanica u širem centru Inđije.",
  "info.d.aerodrom": "Aerodrom je približno 40 km od Inđije.",
  "info.d.taxi": "Taxi prevoz dostupan 00—24.",
  "info.d.domZdravlja":
    "Dom zdravlja u centru Inđije sa dežurnom službom hitne pomoći.",
  "info.d.apoteka": "Apoteka.",

  /* KAKO DO NAS — the one page that is not a directory. */
  "info.route.here": "Adresa",
  "info.route.car": "Automobilom",
  "info.route.carNote":
    "Inđija je povezana auto-putem E75/E70 i starim putem Beograd—Novi Sad.",
  "info.route.train": "Vozom",
  "info.route.trainNote":
    "Inđija je na pruzi Beograd—Novi Sad, a stanica je u širem centru.",
  "info.route.plane": "Avionom",
  "info.route.planeNote":
    "Aerodrom Nikola Tesla je približno 40 km od Inđije.",
  "info.route.open": "Otvori navigaciju",



  /* Captions for the room stills. Written to work read aloud as well as set
     under a photograph — they are the alt text too. */
  "shot.crowd": "Nastup pod punim svetlima, publika u sali",
  "shot.lights": "Podijum pod ljubičastim svetlima",
  "shot.booth": "DJ pult pred vrhunac večeri",

  "date.aug22": "22. avgust",
  "date.aug15": "15. avgust",
  "date.oct25": "25. oktobar",
  "date.jul18": "18. jul",
  "date.jul11": "11. jul",
  "date.jul04": "4. jul",
  "date.jun27": "27. jun",
  "date.may30": "30. maj",
  "date.may16": "16. maj",
  "date.may09": "9. maj",
  "date.apr18": "18. april",

  "atmosfera.title": "*Atmosfera*.",
  "atmosfera.lead":
    "Sala, svetla i ljudi u jednoj prostoriji. Ovako izgleda subota u Plitvicama.",
  "atmosfera.caption": "Iz sale",

  "zurke.title": "Naše *žurke*.",
  "zurke.lead":
    "Svaka subota ima svoje ime. Ovde stoje sva — ona koja dolazi i sve one iza nje.",
  "zurke.upcoming": "Naredna žurka",
  "zurke.past": "Prošle noći",
  "zurke.archive": "Arhiva",

  "trenutci.title": "*Trenutci*.",
  "trenutci.lead": "Sve ono što se ne može prepričati.",
  "trenutci.caption": "Od 1965.",

  "interlude.top": "Plitvice",
  "interlude.title": "Od 1965 sa vama",
  "interlude.bottom": "Ista energija · Nova generacija",

  "about.p3a": "Godine se smenjuju.",
  "about.p3b": "Ime ostaje isto.",
  "about.caption": "Plitvice · od 1965.",
  "about.videoAlt": "Snimci iz kluba Plitvice kroz generacije",

  /* THE ARCHIVE, at /o-nama — the pinned chapter the whole page is now made
     of. Three headlines and, under them, what a screen reader is told each
     film and each photograph shows. Nothing here dates a specific picture:
     the only year it claims is the one on the door. */
  "wall.title1": "Plitvice nisu nastale preko noći.",
  "wall.title2": "Menjali su se zvuk i generacije.",
  "wall.title3": "Od prvih večeri do danas.",

  "wall.altOrigin": "Arhivski snimak Plitvica iz šezdesetih",
  "wall.altStaff": "Konobari Plitvica na arhivskom snimku",
  "wall.altNight": "Žurka u Plitvicama pod svetlima",

  /* The three photographs at the hinge of the story — the house at three
     distances rather than three dated pictures. Nothing here claims a year;
     the only one the page claims is the one on the door. */
  "wall.alt1965": "Plitvice 1965. godine",
  "wall.alt2017": "Plitvice 2017. godine",
  "wall.alt2026": "Plitvice 2026. godine",

  /* The record behind the right edge of every page. Only the labels a screen
     reader reads are here — the mix's name is a title and stays as written. */
  "mix.open": "Otvori plejer",
  "mix.close": "Zatvori plejer",
  "mix.play": "Pusti miks",
  "mix.pause": "Pauziraj miks",
  "mix.seek": "Pozicija u miksu",

  "story.place": "Plitvice · Inđija",
  "story.since": "Od 1965.",
  "story.sameEnergy": "Ista energija.",
  "story.newGeneration": "Nova generacija.",

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
  "location.follow": "*Zapratite* nas!",
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
  /* THE ADMISSION NOTICE, shown over the reservation room before anything in
     it can be touched. House rules, not legalese: what to bring to the door,
     and what the club does and does not refund. */
  "gate.label": "Važne informacije",
  "gate.title": "Pre nego što nastavite",
  "gate.p1":
    "Ulaz je dozvoljen osobama starijim od 16 godina. Prilikom ulaska obavezno je pokazati originalni važeći lični dokument sa fotografijom. Fotografije, skenirane kopije i fotokopije dokumenata se ne prihvataju.",
  "gate.p2":
    "Ukoliko originalni važeći lični dokument nije prisutan, ulazak može biti odbijen i povraćaj novca se ne vrši.",
  "gate.p3":
    "Najavljeni izvođači, program i satnica događaja podložni su promenama. Promena izvođača ili programa sama po sebi ne predstavlja osnov za povraćaj novca za već kupljenu ulaznicu.",
  "gate.p4":
    "Cena ulaznica koje se prodaju direktno u klubu može se razlikovati od cene online ulaznica i može biti promenjena.",
  "gate.accept": "Pročitao/la sam i prihvatam navedene uslove.",
  "gate.continue": "Nastavi",

  "reserve.title": "Rezervacija",
  /* The headline types its way through the three things the room is for. */
  "reserve.headline": "Rezerviši",
  "reserve.word.table": "sto",
  "reserve.word.ticket": "kartu",
  "reserve.word.booth": "separe",
  "reserve.pageLead":
    "Izaberi događaj. Rezerviši svoje mesto. Ostalo prepusti nama.",
  "reserve.which": "Za koju žurku?",
  "reserve.tickets": "Karte",
  "reserve.ticketsLead": "Ulaznice bez rezervacije stola.",
  /* Shown in place of the ticket call when a night is not sold online. */
  "reserve.ticketsOffline": "Nema online prodaje karata",
  "reserve.ticketsOfflineLead": "Rezervacija stolova je dostupna.",
  "reserve.tables": "Stolovi",
  "reserve.tablesLead": "Rezervacija stola za ovu žurku.",
  "reserve.tablesCta": "Izaberi sto",
  "reserve.close": "Zatvori",
  "reserve.name": "Ime i prezime",
  "reserve.phone": "Broj telefona",
  "reserve.phoneShort": "Telefon",
  "reserve.email": "Email",
  "reserve.guests": "Broj osoba",
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

  "reserve.err.name": "Upišite ime i prezime.",
  "reserve.err.phone": "Upišite ispravan broj telefona.",
  "reserve.err.email": "Upišite ispravnu email adresu.",
  "reserve.err.guests": "Broj osoba mora biti između 1 i 50.",
  "reserve.err.time": "Izaberite vreme dolaska.",
  "reserve.err.summary": "Proverite označena polja.",

  /* Karte. */
  /* The floor plan. Zone names are orientation, not signage — see
     lib/floor-plan.ts, which is where the map itself is written. */
  "floor.cta": "Pogledaj raspored stolova",
  "floor.ctaLead": "Izaberite mesto koje vam najviše odgovara.",
  "floor.title": "Raspored stolova",
  "floor.pick": "Izaberite sto",
  "floor.hint": "Prevucite za pomeranje · uštinite za uvećanje",
  "floor.zoomIn": "Uvećaj",
  "floor.zoomOut": "Umanji",
  "floor.reset": "Prikaži ceo klub",
  "floor.type.bar": "Barski sto",
  "floor.type.high": "Visoki sto",
  "floor.type.booth": "Separe",
  "floor.table": "Sto",
  "floor.persons": "osoba",
  "floor.available": "Dostupan",
  "floor.reserved": "Zauzet",
  "floor.choose": "Izaberi sto",
  "floor.chooseBooth": "Izaberi separe",
  "floor.chosen": "Izabrano mesto",
  "floor.change": "Promeni mesto",
  "floor.legendFree": "Slobodno",
  "floor.legendPicked": "Izabrano",
  "floor.legendTaken": "Zauzeto",
  "floor.zone1": "Zona 1",
  "floor.zone2": "Zona 2",
  "floor.zone3": "Zona 3",
  "floor.zone4": "Galerija",
  "floor.stage": "Bina",

  /* The booking that happens on the map itself: the table's own card, then the
     same card turned into the reservation. Nobody leaves the room. */
  "floor.booking": "Rezervacija",
  "floor.min": "Minimum",
  "floor.max": "Maksimum",
  "floor.guestsFewer": "Manje osoba",
  "floor.guestsMore": "Više osoba",
  "floor.back": "Nazad na izbor stola",
  "floor.dismiss": "Zatvori prikaz stola",
  "floor.resume": "Nastavi rezervaciju",
  "floor.forNight": "Za žurku",

  /* When the house says no. A guest is told what it means for them and never
     how the club knows — nothing here describes a check, a limit or somebody
     else's booking. */
  "floor.dup.title": "Već imate rezervaciju",
  "floor.dup.body":
    "Već postoji aktivna rezervacija povezana sa ovim brojem telefona ili email adresom za ovaj događaj.",
  "floor.dup.help": "Za izmenu rezervacije pozovite nas:",
  "floor.dup.back": "Nazad na raspored",
  "floor.gone.title": "Sto je upravo rezervisan",
  "floor.gone.body":
    "Nažalost, ovaj sto je upravo rezervisan. Izaberite drugi sto na rasporedu.",
  "floor.gone.back": "Izaberi drugi sto",
  "floor.err.busy": "Sačekajte trenutak pa pokušajte ponovo.",
  "floor.err.unavailable": "Rezervacije za ovu žurku su zatvorene.",
  "floor.err.failed": "Slanje nije uspelo. Pokušajte ponovo.",

  "tickets.announcements": "Najave idu preko Instagrama:",
  "tickets.type": "Vrsta karte",
  "tickets.entry": "Ulaznica",
  "tickets.count": "Broj karata",
  "tickets.fewer": "Jedna karta manje",
  "tickets.more": "Jedna karta više",
  "tickets.total": "Ukupno",
  "tickets.pay": "Nastavi na plaćanje",
  "tickets.soldOut": "Rasprodato",
} as const;

export type MessageKey = keyof typeof sr;

const en: Record<MessageKey, string> = {
  "nav.events": "Events",
  "nav.parties": "Our parties",
  "nav.gallery": "Gallery",
  "nav.about": "About us",
  "nav.location": "Location",
  "nav.reserve": "Reservations",

  "common.reserve": "Reserve",
  "common.reserveTable": "Book a table",
  "common.openMenu": "Open menu",
  "common.closeMenu": "Close menu",
  "common.menu": "Menu",
  "common.close": "Close",
  "common.skip": "Skip to content",
  "common.toTop": "back to top",
  "common.language": "Language",
  "common.openInstagram": "open Instagram",
  "common.back": "Back to the site",

  "hero.scroll": "Scroll to enter",
  "hero.heading": "Plitvice — Grand Club, Inđija",

  "events.title": "Our *nights*.",
  "events.next": "Next party",
  "events.past": "Past events",
  "events.buy": "Buy a ticket",
  "events.none": "No party is announced right now.",
  "events.lastGuest": "Last guest",
  "events.archived": "Past",

  "event.doors": "Doors",
  "event.ticket": "Ticket",
  "event.info": "Info",

  "event.about.vodkaExperience":
    "Vodka Experience by Plitvice. Music by Dave Pavlo, an atmosphere of its own, and a bottle of vodka on the house for groups arriving before midnight. Minimum 4 guests for a bar table, 4–5 for a high table and 6 for a booth. Entry 16+ with photo ID.",

  "gallery.title": "Our *parties*.",
  "gallery.caption": "Every Saturday",
  "gallery.cta": "See it on Instagram",

  "portals.heading": "Three windows into the world of Plitvice",
  "portals.atmosfera": "Atmosphere",
  "portals.zurke": "Nights",
  "portals.trenutci": "Moments",

  "info.heading": "Useful information for Inđija",
  "info.asking": "Do you need",

  "info.smestaj": "Stay",
  "info.restorani": "Restaurants",
  "info.nonstop": "24h shop",
  "info.prevoz": "Transport",
  "info.prvaPomoc": "First aid",
  "info.kakoDoNas": "Finding us",

  "info.ask.smestaj": "A bed",
  "info.ask.restorani": "A restaurant",
  "info.ask.nonstop": "A 24h shop",
  "info.ask.prevoz": "A ride",
  "info.ask.prvaPomoc": "First aid",
  "info.ask.kakoDoNas": "The way here",

  "info.alt.smestaj": "A made-up hotel room in Inđija",
  "info.alt.restorani": "A laid table in a restaurant in Inđija",
  "info.alt.nonstop": "A lit twenty-four-hour shop at night",
  "info.alt.prevoz": "A taxi on an Inđija street after midnight",
  "info.alt.prvaPomoc": "The door of the night surgery",
  "info.alt.kakoDoNas": "The road into Inđija at night",

  "info.discover": "Look",
  "info.restart": "Back to the start",

  "info.page.eyebrow": "Info",
  "info.page.back": "Info",
  "info.action.call": "Call",
  "info.action.openMap": "Open map",

  "info.page.smestaj.a": "Where to",
  "info.page.smestaj.b": "stay in Inđija.",
  "info.page.smestaj.lead": "Somewhere to sleep, for guests of Plitvice.",
  "info.page.restorani.a": "Restaurants",
  "info.page.restorani.b": "in Inđija.",
  "info.page.restorani.lead": "Dinner before the night, or after it.",
  "info.page.nonstop.a": "Open",
  "info.page.nonstop.b": "00—24.",
  "info.page.nonstop.lead": "For whatever you need after midnight.",
  "info.page.prevoz.a": "Getting",
  "info.page.prevoz.b": "around Inđija.",
  "info.page.prevoz.lead": "Everything you need to arrive, and to get home.",
  "info.page.prva-pomoc.a": "First aid",
  "info.page.prva-pomoc.b": "in Inđija.",
  "info.page.prva-pomoc.lead":
    "The out-of-hours clinic, and the pharmacies in town.",
  "info.page.kako-do-nas.a": "Finding",
  "info.page.kako-do-nas.b": "us.",
  "info.page.kako-do-nas.lead":
    "Inđija is an hour from Belgrade and half an hour from Novi Sad.",

  "info.d.central": "A modern hotel in the very centre of Inđija.",
  "info.d.inClub": "Rooms and breakfast in Inđija.",
  "info.d.mvMonogram":
    "A hotel and restaurant at the Beščanski krst, in quieter country just outside Inđija.",
  "info.d.kord2": "Apartments in the centre of Inđija, inside the TQ Vegas complex.",
  "info.d.monogram":
    "Rooms in a quieter part of Inđija, near the park and the lake.",
  "info.d.perlaLux": "Apartments in the centre of Inđija.",
  "info.d.galerija": "A pizzeria in the centre of Inđija, Italian kitchen.",
  "info.d.gotti":
    "A restaurant in the centre of Inđija, traditional and international.",
  "info.d.corso": "A restaurant and pizzeria in the centre of Inđija.",
  "info.d.perla": "Traditional and international kitchen.",
  "info.d.pekara": "A bakery, savoury and sweet.",
  "info.d.zeleznicka": "The station sits just outside the centre of Inđija.",
  "info.d.autobuska": "The bus station, just outside the centre of Inđija.",
  "info.d.aerodrom": "The airport is around 40 km from Inđija.",
  "info.d.taxi": "Taxis available 00—24.",
  "info.d.domZdravlja":
    "The town clinic in the centre of Inđija, with an out-of-hours emergency service.",
  "info.d.apoteka": "Pharmacy.",

  "info.route.here": "Address",
  "info.route.car": "By car",
  "info.route.carNote":
    "Inđija is on the E75/E70 motorway and the old Belgrade—Novi Sad road.",
  "info.route.train": "By train",
  "info.route.trainNote":
    "Inđija is on the Belgrade—Novi Sad line; the station is just outside the centre.",
  "info.route.plane": "By air",
  "info.route.planeNote":
    "Nikola Tesla airport is around 40 km from Inđija.",
  "info.route.open": "Open navigation",



  "shot.crowd": "On stage under full lights, the room watching",
  "shot.lights": "The dance floor under violet lights",
  "shot.booth": "The booth before the peak of the night",

  "date.aug22": "22 August",
  "date.aug15": "15 August",
  "date.oct25": "25 October",
  "date.jul18": "18 July",
  "date.jul11": "11 July",
  "date.jul04": "4 July",
  "date.jun27": "27 June",
  "date.may30": "30 May",
  "date.may16": "16 May",
  "date.may09": "9 May",
  "date.apr18": "18 April",

  "atmosfera.title": "*Atmosphere*.",
  "atmosfera.lead":
    "Music, light and people in one room. This is what a Saturday at Plitvice looks like.",
  "atmosfera.caption": "From the room",

  "zurke.title": "Our *parties*.",
  "zurke.lead":
    "Every Saturday has a name. All of them are here — the one ahead, and every one behind it.",
  "zurke.upcoming": "Next party",
  "zurke.past": "Past nights",
  "zurke.archive": "Archive",

  "trenutci.title": "*Moments*.",
  "trenutci.lead": "Everything that cannot be retold.",
  "trenutci.caption": "Since 1965",

  "interlude.top": "Plitvice",
  "interlude.title": "With you since 1965",
  "interlude.bottom": "Same energy · New generation",

  "about.p3a": "The years keep turning.",
  "about.p3b": "The name stays the same.",
  "about.caption": "Plitvice · since 1965",
  "about.videoAlt": "Footage from Plitvice club across the generations",

  "wall.title1": "Plitvice was not built overnight.",
  "wall.title2": "The sound and the generations changed.",
  "wall.title3": "From the first evenings to tonight.",

  "wall.altOrigin": "Archival footage of Plitvice in the sixties",
  "wall.altStaff": "The Plitvice waiters in archival footage",
  "wall.altNight": "A party at Plitvice under the lights",

  "wall.alt1965": "Plitvice in 1965",
  "wall.alt2017": "Plitvice in 2017",
  "wall.alt2026": "Plitvice in 2026",

  "mix.open": "Open the player",
  "mix.close": "Close the player",
  "mix.play": "Play the mix",
  "mix.pause": "Pause the mix",
  "mix.seek": "Position in the mix",

  "story.place": "Plitvice · Inđija",
  "story.since": "Since 1965.",
  "story.sameEnergy": "Same energy.",
  "story.newGeneration": "New generation.",

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
  "location.follow": "*Follow* us!",
  "location.maps": "Open in Google Maps",
  "location.mapAria": "Open the location of Plitvice club in Google Maps",
  "location.imgAlt": "The entrance to Plitvice club in Inđija",

  "hours.saturday": "Saturday",
  "hours.time": "22:00 — Last guest",

  "footer.contact": "Social",
  "footer.hours": "Opening hours",
  "footer.location": "Location",
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

  "gate.label": "Important information",
  "gate.title": "Before you continue",
  "gate.p1":
    "Entry is permitted to persons over 16. A valid original photo ID must be shown at the door. Photographs, scans and photocopies of documents are not accepted.",
  "gate.p2":
    "Without a valid original photo ID entry may be refused, and no refund is given.",
  "gate.p3":
    "Announced performers, the programme and the schedule are subject to change. A change of performer or programme is not in itself grounds for a refund on a ticket already bought.",
  "gate.p4":
    "Tickets sold at the door may differ in price from online tickets, and that price may change.",
  "gate.accept": "I have read and accept these conditions.",
  "gate.continue": "Continue",

  "reserve.title": "Reservations",
  "reserve.headline": "Reserve",
  "reserve.word.table": "a table",
  "reserve.word.ticket": "a ticket",
  "reserve.word.booth": "a booth",
  "reserve.pageLead":
    "Choose the event. Reserve your place. Leave the rest to us.",
  "reserve.which": "Which party?",
  "reserve.tickets": "Tickets",
  "reserve.ticketsLead": "Entry without a table.",
  "reserve.ticketsOffline": "No online ticket sales",
  "reserve.ticketsOfflineLead": "Table reservations are available.",
  "reserve.tables": "Tables",
  "reserve.tablesLead": "A table for this party.",
  "reserve.tablesCta": "Choose a table",
  "reserve.close": "Close",
  "reserve.name": "Full name",
  "reserve.phone": "Phone number",
  "reserve.phoneShort": "Phone",
  "reserve.email": "Email",
  "reserve.guests": "Number of guests",
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

  "reserve.err.name": "Please enter your full name.",
  "reserve.err.phone": "Please enter a valid phone number.",
  "reserve.err.email": "Please enter a valid email address.",
  "reserve.err.guests": "The number of guests must be between 1 and 50.",
  "reserve.err.time": "Choose your arrival time.",
  "reserve.err.summary": "Please check the marked fields.",

  "floor.cta": "See the table plan",
  "floor.ctaLead": "Choose the spot that suits you best.",
  "floor.title": "Table plan",
  "floor.pick": "Choose a table",
  "floor.hint": "Drag to move · pinch to zoom",
  "floor.zoomIn": "Zoom in",
  "floor.zoomOut": "Zoom out",
  "floor.reset": "Show the whole club",
  "floor.type.bar": "Bar table",
  "floor.type.high": "High table",
  "floor.type.booth": "Booth",
  "floor.table": "Table",
  "floor.persons": "guests",
  "floor.available": "Available",
  "floor.reserved": "Taken",
  "floor.choose": "Choose this table",
  "floor.chooseBooth": "Choose this booth",
  "floor.chosen": "Your spot",
  "floor.change": "Change spot",
  "floor.legendFree": "Free",
  "floor.legendPicked": "Selected",
  "floor.legendTaken": "Taken",
  "floor.zone1": "Zone 1",
  "floor.zone2": "Zone 2",
  "floor.zone3": "Zone 3",
  "floor.zone4": "Gallery",
  "floor.stage": "Stage",

  "floor.booking": "Reservation",
  "floor.min": "Minimum",
  "floor.max": "Maximum",
  "floor.guestsFewer": "Fewer guests",
  "floor.guestsMore": "More guests",
  "floor.back": "Back to the tables",
  "floor.dismiss": "Dismiss this table",
  "floor.resume": "Continue your reservation",
  "floor.forNight": "For the night of",

  "floor.dup.title": "You already have a table",
  "floor.dup.body":
    "There is already an active reservation for this party under this phone number or email address.",
  "floor.dup.help": "To change it, call us:",
  "floor.dup.back": "Back to the plan",
  "floor.gone.title": "That table has just gone",
  "floor.gone.body":
    "Somebody reserved this table a moment ago. Please choose another one on the plan.",
  "floor.gone.back": "Choose another table",
  "floor.err.busy": "One moment, then please try again.",
  "floor.err.unavailable": "Table reservations for this party are closed.",
  "floor.err.failed": "That did not send. Please try again.",

  "tickets.announcements": "Announcements go out on Instagram:",
  "tickets.type": "Ticket type",
  "tickets.entry": "Entry",
  "tickets.count": "Number of tickets",
  "tickets.fewer": "One ticket fewer",
  "tickets.more": "One ticket more",
  "tickets.total": "Total",
  "tickets.pay": "Continue to payment",
  "tickets.soldOut": "Sold out",
};

export const messages: Record<Lang, Record<MessageKey, string>> = { sr, en };
