"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

/* The house record, and the one thing playing it.
 *
 * There is exactly one <audio> on the site and it lives here, in the root
 * layout, above everything the router replaces. Walking from the home page to
 * the story to the reservation room does not touch it: the element is never
 * unmounted, so the mix does not stop, restart, or lose its place. Any part of
 * the site that wants to know what is playing asks this provider — there is no
 * second copy of the state to fall out of step with the first.
 *
 * The element is the source of truth, not the React state. Everything below
 * is set from the element's own events, so the two can never disagree — not
 * when the browser refuses to play, not when a seek lands late, not when the
 * mix runs out.
 *
 * `preload="metadata"` is deliberate. The file is a thirty-megabyte set and
 * nobody has asked to hear it yet; all that is wanted on arrival is how long
 * it is, so the player can show a real duration instead of a guess. The audio
 * itself is fetched when someone presses play. */

/* The file, named exactly as it sits in /public. */
export const MIX_SRC = "/audio/pawsa-mix.mp3";
export const MIX_TITLE = "PAWSA MIX";

/* The gestures a browser accepts as permission to make a sound. A wheel is
   deliberately not among them: scrolling does not grant playback anywhere, and
   listening for it would only produce refusals. */
const GESTURES = ["pointerdown", "touchstart", "keydown", "click"] as const;

type MixState = {
  isPlaying: boolean;
  /* Seconds. `duration` is 0 until the metadata has landed. */
  duration: number;
  isOpen: boolean;
  /* True once the record has been started at least once — the spin should not
     begin before anyone has asked for it. */
  started: boolean;
  toggle: () => void;
  play: () => void;
  pause: () => void;
  seek: (seconds: number) => void;
  open: () => void;
  close: () => void;
  toggleOpen: () => void;
};

const MixContext = createContext<MixState | null>(null);

/* THE ONE VALUE THAT MOVES, KEPT AWAY FROM THE ONES THAT DO NOT.
 *
 * `timeupdate` fires about four times a second for as long as the record is
 * playing, which is most of a visit. Carried in the context above, it made a
 * new context value four times a second — and the only thing permanently
 * mounted that reads that context, the record on the right-hand edge, re-ran
 * its entire render four times a second for the whole visit, on the same
 * thread the page is scrolling on. Nothing about the record depends on the
 * playhead: it turns on a CSS animation and it slides on a transform.
 *
 * So the playhead is a context of its own. It has exactly one reader — the
 * timeline inside the panel — which is not in the document at all until the
 * controls are opened, so while they are closed the four ticks a second now
 * reach nothing. MixContext carries everything else, and changes only when
 * somebody presses something. */
const MixClockContext = createContext(0);

export function useMix() {
  const value = useContext(MixContext);
  if (!value) throw new Error("useMix must be used inside MixProvider");
  return value;
}

/* Seconds into the set. Reading this re-renders on every tick, so ask for it
   only where the number is actually drawn. */
export function useMixTime() {
  return useContext(MixClockContext);
}

export function MixProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [started, setStarted] = useState(false);

  /* Everything is read back off the element. A play() that the browser turns
     down never reaches `isPlaying`, and a seek only moves the readout once the
     element agrees it has moved. */
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onPlay = () => {
      setIsPlaying(true);
      setStarted(true);
    };
    const onPause = () => setIsPlaying(false);
    const onTime = () => setCurrentTime(audio.currentTime);
    const onMeta = () => {
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
      setCurrentTime(audio.currentTime);
    };
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("seeked", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("durationchange", onMeta);
    audio.addEventListener("ended", onEnded);

    /* Metadata may already be in by the time this runs. */
    if (audio.readyState >= 1) onMeta();

    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("seeked", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("durationchange", onMeta);
      audio.removeEventListener("ended", onEnded);
    };
  }, []);

  /* Opening the controls asks the element where it actually is.
   *
   * Nothing is normally needed here — the readout is kept by the element's own
   * events. But a browser is allowed to put a media element to sleep in a
   * background tab and stop sending them, and the panel must never open on a
   * stale number. This costs one read and settles the question. */
  useEffect(() => {
    if (!isOpen) return;
    const audio = audioRef.current;
    if (!audio) return;
    setCurrentTime(audio.currentTime);
    if (Number.isFinite(audio.duration)) setDuration(audio.duration);
  }, [isOpen]);

  /* Starting the set as early as the browser will allow.
   *
   * The attempt is made on arrival, with sound. Most browsers will refuse it —
   * that is not an error and nothing is said about it. What happens instead is
   * that the first real gesture anywhere on the site is armed to start the
   * mix, so a guest who opens the menu, presses a key or taps a poster gets
   * the music without ever having been asked to press play.
   *
   * Only gestures that actually grant a browser's autoplay permission are
   * listened for. A wheel is not one of them, so scrolling is left alone. The
   * listeners come off the moment a play() succeeds, and are never armed again
   * — after that the record is under the visitor's control, and a pause is a
   * decision, not a thing to talk them out of.
   *
   * Nothing here starts muted. Silent autoplay is a way of appearing to obey
   * the rule while getting round it, and it would put a muted record on the
   * page instead of music. */
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    let armed = false;

    const disarm = () => {
      if (!armed) return;
      armed = false;
      for (const gesture of GESTURES) {
        window.removeEventListener(gesture, onGesture);
      }
    };

    const onGesture = () => {
      void audio.play().then(disarm, () => {});
    };

    const arm = () => {
      if (armed) return;
      armed = true;
      for (const gesture of GESTURES) {
        window.addEventListener(gesture, onGesture, { passive: true });
      }
    };

    void audio.play().then(disarm, arm);

    return disarm;
  }, []);

  const play = useCallback(() => {
    /* A browser is entitled to refuse until someone has touched the page. It
       is not an error worth showing anyone — the record simply stays still. */
    void audioRef.current?.play().catch(() => {});
  }, []);

  const pause = useCallback(() => {
    audioRef.current?.pause();
  }, []);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) void audio.play().catch(() => {});
    else audio.pause();
  }, []);

  /* The readout moves at once so a dragged handle stays under the finger; the
     element catches up and confirms it a moment later. */
  const seek = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(audio.duration)) return;
    const target = Math.min(Math.max(seconds, 0), audio.duration);
    audio.currentTime = target;
    setCurrentTime(target);
  }, []);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggleOpen = useCallback(() => setIsOpen((current) => !current), []);

  const value = useMemo<MixState>(
    () => ({
      isPlaying,
      duration,
      isOpen,
      started,
      toggle,
      play,
      pause,
      seek,
      open,
      close,
      toggleOpen,
    }),
    [
      isPlaying,
      duration,
      isOpen,
      started,
      toggle,
      play,
      pause,
      seek,
      open,
      close,
      toggleOpen,
    ],
  );

  return (
    <MixContext.Provider value={value}>
      <MixClockContext.Provider value={currentTime}>
        <audio ref={audioRef} src={MIX_SRC} preload="metadata" />
        {children}
      </MixClockContext.Provider>
    </MixContext.Provider>
  );
}

/* MM:SS, and H:MM:SS once a set runs past the hour. */
export function timecode(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const whole = Math.floor(seconds);
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const secs = whole % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(secs)}`
    : `${pad(minutes)}:${pad(secs)}`;
}
