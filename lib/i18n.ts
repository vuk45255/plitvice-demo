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
  /* The headline types its way through the three things the room is for. */
  "reserve.headline": "Rezerviši",
  "reserve.word.table": "sto",
  "reserve.word.ticket": "kartu",
  "reserve.word.booth": "separe",
  "reserve.pageLead":
    "Karte i stolovi za noći u Plitvicama. Izaberite žurku, pa način na koji dolazite.",
  "reserve.which": "Za koju žurku?",
  "reserve.tickets": "Karte",
  "reserve.ticketsLead": "Ulaznice bez rezervacije stola.",
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
  "reserve.headline": "Reserve",
  "reserve.word.table": "a table",
  "reserve.word.ticket": "a ticket",
  "reserve.word.booth": "a booth",
  "reserve.pageLead":
    "Tickets and tables for nights at Plitvice. Choose the party, then how you are coming.",
  "reserve.which": "Which party?",
  "reserve.tickets": "Tickets",
  "reserve.ticketsLead": "Entry without a table.",
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
