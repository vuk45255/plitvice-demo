import type { MessageKey } from "@/lib/i18n";

export const site = {
  name: "Plitvice",
  /* The three rails of the house mark — see components/lockup.tsx. */
  tagline: "Grand Club",
  town: "Inđija",
  city: "Inđija, Srbija",
  street: "Cara Dušana 14",
  instagramHandle: "@plitviceclub",
  instagramUrl: "https://www.instagram.com/plitviceclub/",
  facebookUrl:
    "https://www.facebook.com/p/Plitvice-Indjija-100064319426600/",
  tiktokUrl: "https://www.tiktok.com/@plitviceindjija",
  mapsUrl:
    "https://maps.google.com/?q=Plitvice+Club+Cara+Du%C5%A1ana+14+In%C4%91ija",
  /* The reservation is taken on the site now, not in an Instagram DM. Every
     "Rezervacija" opens the reservation room — see
     components/providers/reservation.tsx — and /rezervacija is the same room
     as a page, for anyone who arrives on the link directly. */
  reservePath: "/rezervacija",
  founded: "1965",
  /* Vertical heritage film for the About section. The folder name contains a
     space, so the URL is encoded. If it fails to load, the frame falls back to
     the still. */
  storyVideo: "/o%20nama/0806-small.mp4" as string | null,
  /* The cinematic break between the party wall and the reservation. */
  reelVideo: "/videoplitvica/video123-small.mp4",
  /* Hero background. hero.jpg is its first frame and sits underneath as the
     poster, so the opening never shows an empty frame while this loads. */
  heroVideo: "/images/hero-small.mp4",
  /* Anything a visitor reads is a dictionary key — see lib/i18n.ts. */
  hours: [
    { days: "hours.saturday", time: "hours.time" } satisfies {
      days: MessageKey;
      time: MessageKey;
    },
  ],
};

/* Same order as the page itself. The interlude band is a transition between
   chapters, not a destination, so it has no entry here. */
export const navigation: {
  label: MessageKey;
  href: string;
  /* Opens the reservation room instead of travelling down the page. The href
     stays a real destination so the entry still works without JavaScript. */
  reserve?: true;
}[] = [
  { label: "nav.events", href: "#events" },
  { label: "nav.parties", href: "#gallery" },
  { label: "nav.about", href: "#about" },
  { label: "nav.reserve", href: "/rezervacija", reserve: true },
];

export type ClubEvent = {
  slug: string;
  /* The date is the name of the night — no performer is ever billed here. */
  date?: MessageKey;
  alt: MessageKey;
};

/* The night ahead — the one the section is built around. */
export const featuredEvent: ClubEvent = {
  slug: "dara",
  date: "events.featuredDate",
  alt: "events.featuredAlt",
};

/* Nights that have already happened, kept as a record. */
export const pastEvents: ClubEvent[] = [
  { slug: "kaca", alt: "events.pastAlt" },
  { slug: "semafor", alt: "events.pastAlt" },
];
