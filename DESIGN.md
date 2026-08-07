# PLITVICE CLUB — Design Direction

Creative direction for the Plitvice Club site. Every implementation decision traces back to this document.

## 1. Visual direction

**"The night, edited."** The site is a fashion campaign for a nightclub, not a nightclub website.
One room, after midnight, photographed like a Saint Laurent lookbook: near-black surfaces,
warm light bleeding through darkness, enormous serif typography, and silence between sections.

- Monochrome first: `#050505 / #0B0B0B / #111111` against warm white `#F4F1EA`.
- Light mode is a gallery wall: `#FFFFFF / #F6F6F6 / #ECECEC` with ink `#111111`.
- The only "color" is the warmth inside the imagery — amber light, never UI color.
- A faint film grain sits over the whole page, unifying imagery and surfaces.
- All imagery passes through one grade (`saturate .7, contrast 1.05`) so every photo
  reads as one campaign, shot on one night.

## 2. Design philosophy

Restraint is the luxury. Nothing moves unless it earns it; nothing is decorated.
The grid, the type scale and the pacing do the talking. If a detail could appear in a
template, it is removed. Confidence = few elements, large scale, slow motion.

## 3. User journey

1. **Arrival** — a dark room, a fixed frame, a small instruction. The visitor is at the door.
2. **Entry** — the first scroll doesn't move the page; it opens it. The name is revealed. This is the velvet rope moment.
3. **The house** (About) — who we are, in two sentences and one image.
4. **The calendar** (Events) — three nights, presented like editorial spreads.
5. **The proof** (Gallery) — atmosphere, edge to edge, no chrome.
6. **The invitation** (VIP) — a black page, one sentence, one action.
7. **The door** (Location) — where, when, how to reserve.
8. **The sign-off** (Footer) — the wordmark, once more, at full size.

## 4. Scrolling experience

- Lenis smooth scroll, lerp tuned slow (duration ~1.15) — the page glides, never snaps.
- Scroll is **locked on load**. The first scroll intent triggers the hero sequence;
  scroll unlocks only when the name has been revealed. (Reduced motion or a mid-page
  reload skips the ceremony entirely.)
- After entry: long sections, generous voids between them, content revealed with
  single-use fade/rise masks at −10% viewport margin. Nothing re-animates.
- Hero image gains a slow parallax drift once unlocked, tying the intro to the scroll.

## 5. Animation timeline (hero)

| t | event |
|---|---|
| 0.0s | Page ready. Nav visible. Image at scale 1, overlay 35%. Cue: "Scroll to enter". |
| user scrolls | Scroll frozen. Cue fades. |
| +0.0 → 2.6s | Image zooms 1 → 1.07, overlay deepens to 55%. |
| +0.35 → 2.1s | "PLITVICE" — 8 letters rise out of an overflow mask, staggered 75ms, 1.15s each, ease `cubic-bezier(.16,1,.3,1)`. |
| +2.1s | Subline "CLUB — INĐIJA" fades in beneath. |
| +2.4s | Scroll unlocks. The page continues naturally. |

Global motion rules: no bounce, no overshoot, no springs. One easing curve everywhere
(`.16,1,.3,1`). Durations 0.5–1.6s. Image zooms cap at ~5%. Hovers: 3–4% zoom,
1px text drift, hairline underlines drawn left→right.

## 6. Typography hierarchy

- **Playfair Display** (serif) — display only. The wordmark, section titles, the footer.
- **Inter** (sans) — everything else: body, navigation, labels, data.

| Role | Spec |
|---|---|
| Wordmark | Playfair, `clamp(3.5rem, 14vw, 13rem)`, uppercase |
| Section title | Playfair, `clamp(2.25rem, 5vw, 4.5rem)`, line-height 1.05 |
| Overline / labels | Inter 11px, uppercase, tracking 0.32em, muted |
| Body | Inter 15–17px, line-height 1.7, max-width ~34rem |
| Data (dates, hours) | Inter 12–13px, tracking wide |

Serbian diacritics (Đ, đ — "Inđija") require the `latin-ext` subset on both fonts.

## 7. Spacing system

8px grid throughout. Section padding `py-28` mobile → `py-44` desktop. Content container
max 1440px with 24 / 48 / 80px side padding across breakpoints. Gallery is the single
full-bleed exception (4px gutters, edge to edge). Paragraphs never exceed ~34rem.

## 8. Layout decisions

- **Nav** — transparent over the hero; gains blur + hairline border after 32px of scroll. Logo left, links center-right, theme toggle + Reserve at the edge.
- **About** — asymmetric 12-col grid: title and short paragraph left (cols 1–6), portrait image right (cols 8–12), baseline-misaligned on purpose. Editorial, not "two-column".
- **Events** — three vertical 4:5 cards on one row (stacking intentionally re-composed on mobile), separated by whitespace, not card chrome. Date as overline, title in serif.
- **Gallery** — CSS-column masonry, mixed aspect ratios, zero borders/captions.
- **VIP** — forced `#050505` in both themes. One sentence, one CTA, nothing else.
- **Location** — split: facts (address, hours, Instagram, maps link) against one large visual.
- **Footer** — the wordmark at display scale above three quiet columns and a hairline.
- Each section carries a small index (`01 — The House`) — a consistent editorial device.

## 9. Why each section exists

About establishes credibility in one breath. Events is the reason to return. Gallery is
proof of atmosphere. VIP is the revenue page — hence maximum restraint. Location removes
friction to arrival. Nothing else earned a place; there is no "features", no testimonials,
no newsletter.

## 10. Avoiding the AI look

- No gradients on UI, no glassmorphism, no floating cards, no blobs, no emoji, no icon grids.
- One typeface pairing, one easing curve, one image grade — systems, not samples.
- Asymmetric grids and deliberate misalignment instead of centered stacks.
- Copy is short, declarative and specific to Inđija — no "Elevate your experience".
- Imagery: a single graded campaign of warm-light-in-darkness studies (placeholders are
  generated light compositions, to be replaced by the club's real photography — same
  grade, same crops; see README).
- The grain, the index numbers, the scroll-lock entry: handcraft signals a template can't fake.

## 11. Tech mapping

Next.js 16 App Router (server components everywhere except motion surfaces), Tailwind v4
tokens in `globals.css`, framer-motion 13 for reveals/hero, Lenis for scroll (GSAP omitted —
nothing here requires it, and less JS is the point). Theme = `.dark` class, default dark,
no-flash inline script, choice persisted. Reduced motion collapses all animation to state.
