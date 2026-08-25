"use client";

import { useEffect, useRef } from "react";

/* ONE VIDEO DECODES AT A TIME, AND ONLY WHILE IT IS BEING LOOKED AT.
 *
 * A muted looping `autoPlay` video does not stop when it scrolls off the top
 * of the page: it keeps decoding, keeps compositing a new frame every
 * sixteenth of a second, and keeps that work on the same thread the scroll is
 * running on. Two of them on a page — the hero and the interlude on the home
 * page, the claim and the archive on /o-nama — is two decoders competing with
 * the scroll for a phone's single performance core, and it is the largest
 * single thing a phone here was paying for.
 *
 * So no film on this site sets `autoPlay`. Each one is handed this instead: an
 * observer plays it when it comes within reach of the screen and pauses it the
 * moment it has gone, and a hidden tab pauses everything. The poster carries
 * the frame in between, which is what a poster is for.
 *
 * The margin is generous on purpose. Playback is started before the film is on
 * screen rather than as it lands, so the first frame a visitor sees is moving
 * — the point is to stop a film that nobody is watching, not to make the
 * visitor watch it start.
 *
 * `active` is the caller's own veto — reduced motion, a scene the camera has
 * not reached. False pauses and keeps it paused. */
export function useFilmInView<T extends HTMLVideoElement>(
  active = true,
  margin = "300px 0px",
) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const film = ref.current;
    if (!film) return;

    if (!active) {
      film.pause();
      return;
    }

    let near = false;

    const sync = () => {
      /* Autoplay can be refused — a data-saver setting, a battery mode, a
         tab that has never been touched. Nothing else about the composition
         changes when it is: the poster is already the film's first frame. */
      if (near && document.visibilityState === "visible")
        void film.play().catch(() => {});
      else film.pause();
    };

    const watch = new IntersectionObserver(
      ([entry]) => {
        near = entry.isIntersecting;
        sync();
      },
      { rootMargin: margin },
    );

    watch.observe(film);
    document.addEventListener("visibilitychange", sync);

    return () => {
      watch.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, [active, margin]);

  return ref;
}
