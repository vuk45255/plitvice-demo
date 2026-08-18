import type { Lang, MessageKey } from "@/lib/i18n";

/* The club, as Google knows it. One query behind both the link out and the map
   drawn into the page, so the two can never point at different doors. */
const MAPS_QUERY = "Plitvice+Club+Cara+Du%C5%A1ana+14+In%C4%91ija";

export const site = {
  name: "Plitvice",
  /* The three rails of the house mark — see components/lockup.tsx. */
  tagline: "Grand Club",
  town: "Inđija",
  city: "Inđija, Srbija",
  street: "Cara Dušana 14",
  /* The number on the door. Written the way it is said, and dialled by
     stripping the spaces — see the INFO line in the reservation room. */
  phone: "069 60 60 50",
  instagramHandle: "@plitviceclub",
  instagramUrl: "https://www.instagram.com/plitviceclub/",
  facebookUrl:
    "https://www.facebook.com/p/Plitvice-Indjija-100064319426600/",
  tiktokUrl: "https://www.tiktok.com/@plitviceindjija",
  mapsUrl: `https://maps.google.com/?q=${MAPS_QUERY}`,
  /* One reservation room, one address. Every "Rezervacija", every "Kupi kartu"
     and every "Rezerviši sto" on the site is a link here; a night is carried in
     the query (/rezervacija?event=<slug>) so the room opens on the right one. */
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

/* The map itself, for the frame in the Location section.
 *
 * `output=embed` is Google's own keyless embed — no API key, no billing account
 * and no script on the page, just an iframe that pans, zooms and hands the
 * visitor over to Google Maps for the route. The place is named rather than
 * pinned by coordinate: the club's address is the thing we know, and Google
 * resolves it to the same door `mapsUrl` opens. */
export function mapsEmbedUrl(lang: Lang) {
  return `https://maps.google.com/maps?q=${MAPS_QUERY}&hl=${lang}&t=&z=17&ie=UTF8&iwloc=&output=embed`;
}

/* Same order as the page itself. The interlude band is a transition between
   chapters, not a destination, so it has no entry here. Entries beginning with
   "#" travel down the page; the rest are pages. */
export const navigation: { label: MessageKey; href: string }[] = [
  { label: "nav.events", href: "#events" },
  { label: "nav.parties", href: "#gallery" },
  { label: "nav.about", href: "#about" },
  { label: "nav.reserve", href: "/rezervacija" },
];
