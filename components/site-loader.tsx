"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useEntrance } from "@/components/providers/entrance";
import { PlitviceLogo } from "@/components/brand/plitvice-logo";
import { site } from "@/lib/site";

/* THE CURTAIN BEFORE THE CLUB.
 *
 * Shown once per browser session, on the first page of the site that session
 * opens — whichever page that is. It is in the server's HTML, so it is the
 * first thing painted, and it lets go when the FIRST SCREEN is ready to be
 * looked at, not when a timer says so.
 *
 * ─── WHAT IT WAITS FOR ────────────────────────────────────────────────────
 *
 *   type     the two families the site is set in — Playfair and Inter — so no
 *            line of the first screen is ever drawn in a fallback face and
 *            then swapped. The loader's own town rail waits for the same two
 *            (see the inline script below); its mark is outlines and waits
 *            for nothing.
 *   stills   every <img> whose box is on the first screen, loaded AND
 *            decoded, so it appears whole rather than being painted in as the
 *            curtain lifts. One that the browser has deferred as lazy is
 *            asked for now; nothing below the fold is touched.
 *   films    the poster of every <video> on the first screen, decoded — on
 *            the home page that is the hero's first frame — and then, for a
 *            short grace at most, the film's own first frame, so the curtain
 *            usually lifts on a room that is already moving. If the film is
 *            slower than that (a phone in low-power mode will refuse to play
 *            it at all) the poster is the first frame by design and the film
 *            takes over from it without a seam.
 *   its own  the mark finishing its entrance, so the curtain is never pulled
 *   motion   away mid-gesture. That is a second on a fast connection and
 *            nothing at all on a slow one, where everything above takes longer
 *            anyway.
 *
 * It does NOT wait for anything below the fold, for the mix, or for any film
 * that is not on the first screen.
 *
 * ─── IT CANNOT TRAP ANYBODY ───────────────────────────────────────────────
 *
 * A failed image resolves; a failed font resolves; a film that never delivers
 * a frame is only waited for briefly. Over all of it sits a hard limit, after
 * which the curtain lifts whatever is still outstanding. And if the page's
 * JavaScript never runs at all, the stylesheet lifts it by itself — see
 * `.site-loader` in app/globals.css.
 *
 * It never touches the document's overflow. Holding the page still under it is
 * done by the overlay itself: `touch-action: none`, and a wheel/touchmove
 * handler bound to this one element, which goes away with it. There is no
 * lock that could be left behind.
 *
 * ─── AND NOT AGAIN ────────────────────────────────────────────────────────
 *
 * Internal navigation never shows it: this component lives in
 * app/(site)/layout.tsx, above the router, and is gone for the life of the
 * layout once it has lifted. A reload or a new page in the same tab session is
 * recognised before paint by the inline script and never draws it at all. */

const ARRIVED = "plitvice-arrived";

/* The whole wait, from the moment the page is interactive. */
const HARD_LIMIT_MS = 6000;
/* How long the first frame of an on-screen film is waited for once everything
   else on the first screen is ready. Beyond it, the poster stands in. */
const FILM_GRACE_MS = 1200;
/* A little longer than the fade in app/globals.css, for the unmount. */
const LEAVE_MS = 950;

const FAMILIES = ["--font-playfair", "--font-inter"];

/* Runs while the document is being parsed, before the curtain is painted. A
   session that has already been through the door gets `data-arrived`, which
   hides the curtain in CSS; otherwise the mark is told when its type is in. */
const ARRIVAL_SCRIPT = `(function(){var d=document.documentElement;try{if(sessionStorage.getItem("${ARRIVED}")){d.setAttribute("data-arrived","");return}}catch(e){}function r(){d.setAttribute("data-type-ready","")}try{var s=getComputedStyle(d);Promise.all(${JSON.stringify(
  FAMILIES,
)}.map(function(v){return document.fonts.load("1em "+s.getPropertyValue(v))})).then(r,r)}catch(e){r()}})()`;

/* Whether this session had already arrived WHEN THIS DOCUMENT OPENED. Asked
   once and remembered, because the answer is about the past: the curtain
   writes the flag itself as it lifts, and must not then read its own
   writing and vanish halfway through its fade. */
let arrivedAtOpen: boolean | undefined;

function arrivedBefore() {
  if (arrivedAtOpen !== undefined) return arrivedAtOpen;
  if (document.documentElement.hasAttribute("data-arrived")) {
    arrivedAtOpen = true;
  } else {
    try {
      arrivedAtOpen = sessionStorage.getItem(ARRIVED) !== null;
    } catch {
      arrivedAtOpen = false;
    }
  }
  return arrivedAtOpen;
}

function remember() {
  try {
    sessionStorage.setItem(ARRIVED, "1");
  } catch {
    /* private mode — the curtain simply plays again next time */
  }
}

const noSubscription = () => () => {};

type Phase = "covering" | "leaving" | "gone";

export function SiteLoader() {
  const { setCurtain } = useEntrance();
  const ref = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>("covering");

  /* True only while React is hydrating the server's HTML. The inline script
     is part of that HTML and has already run; it is never rendered by the
     client, where a script tag does nothing but warn. */
  const hydrating = useSyncExternalStore(
    noSubscription,
    () => false,
    () => true,
  );

  /* A returning session: false on the server and through hydration, which is
     what the server drew; true on the client from the first render after, and
     from the very first render when the site is mounted without a server
     document (entered from elsewhere in the app). Gone before a client paint
     either way — and the inline script had already hidden it in CSS. */
  const returning = useSyncExternalStore(
    noSubscription,
    arrivedBefore,
    () => false,
  );

  useLayoutEffect(() => {
    if (returning) setCurtain("none");
  }, [returning, setCurtain]);

  useEffect(() => {
    const loader = ref.current;
    if (!loader || arrivedBefore()) return;

    let finished = false;
    let cancelled = false;
    const timers: number[] = [];

    /* On a connection slow enough that the stylesheet's own failsafe has
       already lifted the curtain before this ran, it stays lifted. */
    const failsafe = loader
      .getAnimations()
      .find(
        (animation) =>
          animation instanceof CSSAnimation &&
          animation.animationName === "site-loader-failsafe",
      );
    if (
      failsafe &&
      (failsafe.playState === "finished" ||
        Number(failsafe.currentTime ?? 0) >= 9000)
    ) {
      remember();
      setCurtain("lifted");
      timers.push(window.setTimeout(() => setPhase("gone"), 0));
      return () => timers.forEach((timer) => window.clearTimeout(timer));
    }

    /* Otherwise the stylesheet's no-JavaScript failsafe stands down, and this
       one takes over. */
    loader.setAttribute("data-live", "");

    const hold = (event: Event) => {
      if (event.cancelable) event.preventDefault();
    };
    loader.addEventListener("wheel", hold, { passive: false });
    loader.addEventListener("touchmove", hold, { passive: false });

    const release = () => {
      if (finished || cancelled) return;
      finished = true;
      remember();
      loader.style.setProperty("--loader-done", "1");
      setPhase("leaving");
      setCurtain("lifted");
      timers.push(window.setTimeout(() => setPhase("gone"), LEAVE_MS));
    };

    timers.push(window.setTimeout(release, HARD_LIMIT_MS));

    void firstScreen(loader, (done, total) => {
      if (!finished)
        loader.style.setProperty("--loader-done", String(done / total));
    }).then(release);

    return () => {
      cancelled = true;
      timers.forEach((timer) => window.clearTimeout(timer));
      loader.removeEventListener("wheel", hold);
      loader.removeEventListener("touchmove", hold);
    };
  }, [setCurtain]);

  if (phase === "gone" || returning) return null;

  return (
    <>
      {hydrating ? (
        <script dangerouslySetInnerHTML={{ __html: ARRIVAL_SCRIPT }} />
      ) : null}
      <div
        ref={ref}
        className="site-loader"
        data-loader=""
        data-state={phase === "leaving" ? "leaving" : undefined}
        data-lenis-prevent=""
        aria-hidden="true"
      >
        {/* The house mark, quieter than the hero's own: the lockup, then the
            town. The hero draws the full-size mark in the same place as this
            one fades, so the two read as one gesture. Inline outlines — no
            file, no font, nothing for the curtain to wait on. */}
        <div className="site-loader__mark flex flex-col items-center px-6 text-center">
          <PlitviceLogo
            variant="primary"
            decorative
            className="h-auto w-[min(62vw,18rem)] text-night-ink"
          />
          <span className="mt-5 text-[0.5625rem] uppercase tracking-[0.62em] indent-[0.62em] text-gold-light/70">
            {site.town}
          </span>
        </div>

        <div className="site-loader__line mt-10">
          <span className="site-loader__fill" />
          <span className="site-loader__glint" />
        </div>
      </div>
    </>
  );
}

/* ─── the first screen ────────────────────────────────────────────────────── */

function onFirstScreen(element: Element) {
  const box = element.getBoundingClientRect();
  return (
    box.width > 0 &&
    box.height > 0 &&
    box.bottom > 0 &&
    box.right > 0 &&
    box.top < window.innerHeight &&
    box.left < window.innerWidth
  );
}

function firstFrame(film: HTMLVideoElement) {
  return new Promise<void>((resolve) => {
    if (film.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) return resolve();
    const done = () => {
      film.removeEventListener("loadeddata", done);
      film.removeEventListener("error", done);
      resolve();
    };
    film.addEventListener("loadeddata", done);
    film.addEventListener("error", done);
  });
}

const settle = (promise: Promise<unknown>) =>
  promise.then(
    () => undefined,
    () => undefined,
  );

async function firstScreen(
  loader: HTMLElement,
  progress: (done: number, total: number) => void,
) {
  const work: Promise<void>[] = [];

  /* type */
  const root = getComputedStyle(document.documentElement);
  for (const family of FAMILIES) {
    const value = root.getPropertyValue(family).trim();
    if (value && "fonts" in document)
      work.push(settle(document.fonts.load(`1em ${value}`)));
  }

  /* stills */
  document.querySelectorAll("img").forEach((image) => {
    if (loader.contains(image) || !onFirstScreen(image)) return;
    if (image.loading === "lazy" && !image.complete) image.loading = "eager";
    work.push(settle(image.decode()));
  });

  /* films: the poster now, the first frame after */
  const films = Array.from(document.querySelectorAll("video")).filter(
    onFirstScreen,
  );
  films.forEach((film) => {
    if (!film.poster) return;
    const poster = new Image();
    poster.src = film.poster;
    work.push(settle(poster.decode()));
  });

  /* its own motion: the mark's entrance, if it is still under way */
  const mark = loader.querySelector<HTMLElement>(".site-loader__mark");
  if (mark && mark.getAnimations().some((a) => a.playState !== "finished"))
    work.push(
      settle(
        Promise.all(
          mark.getAnimations().map((animation) => animation.finished),
        ),
      ),
    );

  const total = work.length + (films.length ? 1 : 0);
  let done = 0;
  const tick = () => progress(++done, Math.max(total, 1));
  await Promise.all(work.map((item) => item.then(tick)));

  if (films.length) {
    await Promise.race([
      Promise.all(films.map(firstFrame)),
      new Promise((resolve) => window.setTimeout(resolve, FILM_GRACE_MS)),
    ]);
    tick();
  }
}
