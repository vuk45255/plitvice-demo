"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type QrScannerType from "qr-scanner";
import { ScanResult } from "@/components/ticketing/scan-result";
import { t } from "@/lib/ticketing/copy";
import type { RedemptionResult } from "@/lib/ticketing/types";

/* THE DOOR, AS A PHONE.
 *
 * ═══ WHAT THIS COMPONENT IS NOT ALLOWED TO DO ═════════════════════════════
 *
 * It does not decide anything. It reads a string off a camera, posts it, and
 * paints whatever comes back. It never looks at a ticket's status, never
 * caches a verdict, never remembers that it saw this code a moment ago and
 * lets it through again. Every judgement — is this a ticket, is it for
 * tonight, may it come in, is it now used — is made in one indivisible step on
 * the server, because two doormen with two phones at the same code is not a
 * hypothetical. See lib/ticketing/redeem.ts.
 *
 * ═══ THE CAMERA HAS SEVEN STATES AND EVERY ONE OF THEM IS SAID OUT LOUD ═══
 *
 * The bug this replaces was a phone that sat on "Uključivanje kamere…" for
 * ever. It sat there because every way a camera can fail was collapsed into
 * one `catch` that set one word, and because two of the failures — an insecure
 * origin, and a permission prompt nobody answers — never throw at all.
 *
 *   idle       nothing started yet (server render, or between attempts)
 *   starting   the decoder is loading, or the camera is being asked for
 *   ready      a stream is running and frames are being decoded
 *   denied     the guest of honour: PERMISSION REFUSED. Named separately
 *              because the fix is in the browser's own settings and no amount
 *              of retrying will help.
 *   missing    no camera on the device at all
 *   busy       another application has it (the common iOS case)
 *   insecure   http, so the browser will not hand out a camera AT ALL. This
 *              one is detected BEFORE anything is attempted, because nothing
 *              throws — the API simply is not there — and a page that waits
 *              for an error that never comes waits for ever.
 *   failed     anything else, with a retry button rather than a dead end.
 *
 * THERE IS ALSO A WATCHDOG. `getUserMedia` on iOS Safari can hang indefinitely
 * behind an unanswered permission sheet: no resolve, no reject, no event. So
 * the start is raced against a timer, and a camera that has not produced a
 * frame in fifteen seconds is reported as `failed` with a retry. A doorman
 * gets a button; nobody gets a spinner that never ends.
 *
 * MANUAL ENTRY IS ALWAYS THERE, in every one of those states, because the
 * queue does not stop while somebody works out why the camera is unhappy.
 *
 * ═══ WHY THE CAMERA LIBRARY IS LOADED THE WAY IT IS ═══════════════════════
 *
 * `qr-scanner` is imported dynamically, inside the effect, after the page has
 * painted. The scanner has to open on whatever signal there is in a doorway,
 * so the first thing on the screen is the interface — the camera frame, the
 * manual entry — and the decoder arrives a moment later. It prefers the
 * browser's own BarcodeDetector where there is one and only falls back to its
 * worker where there is not.
 *
 * ═══ ONE CODE, ONE REQUEST ════════════════════════════════════════════════
 *
 * A camera decoding five frames a second sees the same QR five times a second.
 * Three separate things stop that becoming twenty requests: a busy flag while
 * one is in flight, the decoder being STOPPED the moment a code is accepted,
 * and a short memory of the last string that was sent.
 *
 * ═══ THE <video> IS MOUNTED ONCE AND NEVER UNMOUNTED ══════════════════════
 *
 * THIS IS A RULE, NOT A DETAIL, and breaking it is what put a black rectangle
 * in front of a doorman with a queue.
 *
 * `QrScanner` takes a video element in its constructor and holds it as
 * `readonly $video` — see node_modules/qr-scanner/types/qr-scanner.d.ts. There
 * is no way to point a live instance at a different element. So the moment the
 * result screen was rendered with an early `return`, the whole scanning tree
 * went with it: React detached that <video>, the instance kept its reference to
 * the orphan, and "Skeniraj sledeću" mounted a BRAND NEW element that no
 * decoder had ever heard of. The restart below then dutifully started the
 * camera — into the detached element. Torch on, nothing on screen, and because
 * the state still said `ready` the overlay that would have explained it was
 * suppressed. Only a full reload, which remounts this component and builds a
 * scanner around the live element, could clear it.
 *
 * So the verdict is rendered BESIDE the scanner and the scanner is hidden with
 * a class, never unmounted. Note that it must be a class: Tailwind's `flex` is
 * an author style and would win against the `hidden` attribute's rule in the
 * user-agent sheet, so the element would stay visible.
 *
 * ═══ WHAT DECIDES WHETHER THE CAMERA IS RUNNING ═══════════════════════════
 *
 * One derived boolean — `shouldScan` — and not a transition. It used to be an
 * effect on `result`, which meant the camera was restarted only by a verdict
 * arriving and then going away. Every other way a scan can end left the door
 * dead: `onScan` stops the decoder BEFORE it posts, so a 401, a 409 or a
 * dropped connection at the door set a message, left `result` null, and
 * nothing ever started the camera again. Same black rectangle, different
 * morning. Asking "should it be running now" instead has no such gaps. */

type CameraState =
  | "idle"
  | "starting"
  | "ready"
  | "denied"
  | "missing"
  | "busy"
  | "insecure"
  | "failed";

/* Long enough for a slow phone to wake its camera, short enough that nobody
   stands there wondering. */
const START_TIMEOUT_MS = 15_000;
/* A code that was just sent is ignored for this long, so a guest holding their
   screen up while the result is on the doorman's phone does not queue another
   request behind it. */
const REPEAT_GUARD_MS = 3_000;

export function Scanner({
  eventTitle,
}: {
  /* WHICH NIGHT THIS DOOR IS WORKING IS NOT A PROP AND IS NOT SENT.
     The redemption endpoint reads it off the door's own setting on the server;
     a phone that could name the night in each request would be a phone that
     decides whether a ticket is for tonight. All that arrives here is the
     TITLE, so the screen can say what is being scanned. */
  eventTitle: string | null;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<QrScannerType | null>(null);
  /* Set while a request is in flight, so a camera happily decoding five frames
     a second cannot post the same code five times. */
  const busyRef = useRef(false);
  /* And the last thing that was sent, with the moment it was sent, for the
     same reason a second time over. */
  const lastSent = useRef<{ value: string; at: number } | null>(null);
  /* The camera track currently being watched for an unexpected end. */
  const watchedTrack = useRef<MediaStreamTrack | null>(null);
  /* Bumped to start the camera again after a failure. */
  const [attempt, setAttempt] = useState(0);

  const [camera, setCamera] = useState<CameraState>("idle");
  const [result, setResult] = useState<RedemptionResult | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  /* ── the one call this component makes ────────────────────────────────── */
  const submit = useCallback(async (payload: { scanned?: string; typed?: string }) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setChecking(true);
    setProblem(null);

    try {
      const response = await fetch("/api/ticketing/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.status === 401) {
        setProblem(t.sessionLost);
        return;
      }
      if (response.status === 409) {
        /* The door has no night set. Not a verdict about anybody's ticket. */
        setProblem(t.noEventTonight);
        return;
      }

      const verdict = (await response.json()) as RedemptionResult;
      setResult(verdict);
      buzz(verdict.outcome);
    } catch {
      setProblem(t.networkError);
    } finally {
      busyRef.current = false;
      setChecking(false);
    }
  }, []);

  /* What the decoder hands back, filtered before it costs a request. */
  const onScan = useCallback(
    (value: string) => {
      const now = Date.now();
      const last = lastSent.current;
      if (last && last.value === value && now - last.at < REPEAT_GUARD_MS) return;
      lastSent.current = { value, at: now };

      /* STOPPED, NOT PAUSED, and before the request rather than after it: the
         next frame is already on its way while this one is being posted. */
      scannerRef.current?.stop();
      void submit({ scanned: value });
    },
    [submit],
  );

  /* ── the camera ───────────────────────────────────────────────────────── */
  useEffect(() => {
    if (typeof window === "undefined") return;

    let cancelled = false;
    let scanner: QrScannerType | null = null;
    let watchdog: ReturnType<typeof setTimeout> | null = null;

    (async () => {
      /* SAID PLAINLY RATHER THAN LEFT AS A CAMERA THAT NEVER OPENS.
         A browser will not hand out a camera on an insecure origin — over the
         office wifi at http://192.168.… `mediaDevices` is not even defined —
         so there is no error to wait for, and waiting is the bug. */
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setCamera("insecure");
        return;
      }

      setCamera("starting");

      try {
        const { default: QrScanner } = await import("qr-scanner");
        if (cancelled || !videoRef.current) return;

        if (!(await QrScanner.hasCamera())) {
          if (!cancelled) setCamera("missing");
          return;
        }

        scanner = new QrScanner(
          videoRef.current,
          (scan) => {
            /* Nothing is judged here. The string goes to the server as it was
               read, and the server says what it means. */
            onScan(scan.data);
          },
          {
            /* The back camera, which is the one pointed at a guest's phone. */
            preferredCamera: "environment",
            highlightScanRegion: true,
            highlightCodeOutline: true,
            /* Five looks a second is plenty for a code being held still, and
               it keeps an old phone from getting hot in somebody's hand. */
            maxScansPerSecond: 5,
            returnDetailedScanResult: true,
          },
        );

        scannerRef.current = scanner;

        /* THE WATCHDOG. `start()` can hang for ever behind an unanswered iOS
           permission sheet — it neither resolves nor rejects — and that is
           exactly the state that used to leave this page saying "Uključivanje
           kamere…" until somebody gave up. */
        watchdog = setTimeout(() => {
          if (!cancelled) setCamera((state) => (state === "starting" ? "failed" : state));
        }, START_TIMEOUT_MS);

        await scanner.start();
        if (cancelled) return;
        if (watchdog) clearTimeout(watchdog);
        setCamera("ready");
      } catch (error: unknown) {
        if (cancelled) return;
        if (watchdog) clearTimeout(watchdog);
        setCamera(readFailure(error));
      }
    })();

    return () => {
      cancelled = true;
      if (watchdog) clearTimeout(watchdog);
      scanner?.stop();
      scanner?.destroy();
      scannerRef.current = null;
    };
  }, [onScan, attempt]);

  /* A stream can die underneath the page without anything throwing: the camera
     is taken by another application, the device sleeps, a track is revoked. The
     picture simply stops. `ended` is the browser saying so — and it is NOT
     fired when we stop a track ourselves, which is exactly the distinction
     wanted here. Reported as `failed`, which is the state that carries a retry
     button, so nobody is left tapping a black square. */
  const watchStream = useCallback(() => {
    const stream = videoRef.current?.srcObject;
    if (!(stream instanceof MediaStream)) return;
    const [track] = stream.getVideoTracks();
    /* Once per track, not once per scan. A quick verdict is dismissed inside
       the library's own 300ms grace period, so the stream — and this exact
       track — is often still the one from an hour ago; without this a busy
       night would hang hundreds of listeners on it. */
    if (!track || track === watchedTrack.current) return;
    watchedTrack.current = track;
    track.addEventListener(
      "ended",
      () => setCamera((state) => (state === "ready" ? "failed" : state)),
      { once: true },
    );
  }, []);

  /* THE CAMERA RUNS WHEN THERE IS NOTHING IN THE WAY OF IT.
     Not while a verdict is being read — both so it cannot post the same code
     again behind the result and so the phone is not running a decoder nobody is
     looking at — and not while a request is in flight. Anything else, it runs. */
  const shouldScan = !result && !checking;

  useEffect(() => {
    const scanner = scannerRef.current;
    if (!scanner || camera !== "ready") return;

    if (!shouldScan) {
      scanner.stop();
      return;
    }

    /* `start()` is safe to call on a scanner that is already running — the
       library returns early unless it is stopped or paused — so this cannot
       stack up a second stream on a re-render. */
    let cancelled = false;
    scanner.start().then(
      () => {
        if (!cancelled) watchStream();
      },
      () => {
        /* The camera would not come back: another application took it while the
           verdict was on screen, or permission was withdrawn in settings. A
           retry button, never a page somebody has to reload. */
        if (!cancelled) setCamera("failed");
      },
    );
    return () => {
      cancelled = true;
    };
  }, [shouldScan, camera, watchStream]);

  /* An admission clears itself, because a queue moves and nobody wants to tap
     a phone between every guest. Every refusal stays until it is dismissed:
     somebody has to read it and deal with the person in front of them. */
  useEffect(() => {
    if (result?.outcome !== "valid") return;
    const timer = setTimeout(() => setResult(null), 2200);
    return () => clearTimeout(timer);
  }, [result]);

  const notice = CAMERA_NOTICE[camera];

  return (
    <>
      {result ? (
        <ScanResult result={result} onDismiss={() => setResult(null)} />
      ) : null}

      {/* HIDDEN, NEVER UNMOUNTED — see the note at the top of this file. The
          <video> below is the element the decoder was built around, and it has
          to be the same element for the whole life of the page. */}
      <div className={result ? "hidden" : "flex flex-col gap-6"}>
        {/* ── which night ────────────────────────────────────────────────── */}
        {eventTitle ? (
          <p className="text-center text-[0.625rem] uppercase tracking-[0.28em] text-night-ink/35">
            {t.scanningFor} <span className="text-night-ink/70">{eventTitle}</span>
          </p>
        ) : (
          <p
            role="alert"
            className="border border-[#e6a091]/30 bg-[#e6a091]/[0.06] px-4 py-3 text-center text-[0.75rem] leading-relaxed text-[#e6a091]"
          >
            {t.noEventTonight}
          </p>
        )}

        {/* ── the camera frame ───────────────────────────────────────────── */}
        <div className="relative aspect-square w-full overflow-hidden border border-line bg-black">
          <video
            ref={videoRef}
            className="h-full w-full object-cover"
            playsInline
            muted
          />

          {camera !== "ready" ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-night px-6 text-center">
              <p className="text-[0.6875rem] uppercase tracking-[0.28em] text-night-ink/70">
                {notice.title}
              </p>
              {notice.body ? (
                <p className="max-w-[20rem] text-[0.8125rem] leading-relaxed text-night-ink/45">
                  {notice.body}
                </p>
              ) : null}
              {notice.retry ? (
                <button
                  type="button"
                  onClick={() => {
                    setCamera("idle");
                    setAttempt((n) => n + 1);
                  }}
                  className="mt-2 text-[0.6875rem] uppercase tracking-[0.24em] text-gold underline-offset-4 hover:underline"
                >
                  {t.cameraRetry}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        {camera === "ready" ? (
          <p className="text-center text-[0.6875rem] uppercase tracking-[0.28em] text-night-ink/45">
            {checking ? t.checking : t.scannerReady}
          </p>
        ) : null}

        {problem ? (
          <p role="alert" className="text-center text-[0.8125rem] text-[#e6a091]">
            {problem}
          </p>
        ) : null}

        {/* ── the same door, typed ─────────────────────────────────────── */}
        <ManualEntry busy={checking} onSubmit={(typed) => submit({ typed })} />
      </div>
    </>
  );
}

/* What each camera state says. In one table rather than in a chain of ternary
   operators inside the markup, so that adding a state is adding a row and it
   is obvious at a glance that none of them is a spinner. */
const CAMERA_NOTICE: Record<
  CameraState,
  { title: string; body?: string; retry?: boolean }
> = {
  idle: { title: t.scannerStarting },
  starting: { title: t.scannerStarting },
  ready: { title: t.scannerReady },
  denied: { title: t.cameraDenied, body: t.cameraDeniedBody, retry: true },
  missing: { title: t.cameraMissing, body: t.cameraMissingBody },
  busy: { title: t.cameraBusy, body: t.cameraBusyBody, retry: true },
  insecure: { title: t.insecure, body: t.insecureBody },
  failed: { title: t.cameraFailed, body: t.cameraFailedBody, retry: true },
};

/* Which failure this was. The names are the DOMException ones every browser
   agrees on; anything unrecognised is `failed`, which offers a retry rather
   than pretending to know. */
function readFailure(error: unknown): CameraState {
  const name = (error as { name?: string })?.name ?? "";
  const message = String((error as { message?: string })?.message ?? error ?? "");

  if (name === "NotAllowedError" || name === "SecurityError") return "denied";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "missing";
  if (name === "NotReadableError" || name === "AbortError") return "busy";

  /* qr-scanner's own wording, which is a plain string rather than a
     DOMException and is what actually arrives on some Android builds. */
  if (/permission|denied/i.test(message)) return "denied";
  if (/no camera|not found/i.test(message)) return "missing";
  return "failed";
}

/* A cracked screen, a phone at two per cent, a guest who has the reference in
   a message but cannot open the ticket. The reference is typed and goes to THE
   SAME ENDPOINT, through THE SAME validation — there is no second, looser path
   into the club, and there must never be. */
function ManualEntry({
  onSubmit,
  busy,
}: {
  onSubmit: (typed: string) => void;
  busy: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mx-auto text-[0.6875rem] uppercase tracking-[0.28em] text-night-ink/45 underline-offset-4 transition-colors duration-500 hover:text-gold"
      >
        {t.manualEntry}
      </button>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!value.trim() || busy) return;
        onSubmit(value);
        setValue("");
      }}
      className="flex flex-col gap-4"
    >
      <label
        htmlFor="ticket-reference"
        className="text-[0.625rem] uppercase tracking-[0.3em] text-night-ink/45"
      >
        {t.manualLabel}
      </label>

      <input
        id="ticket-reference"
        name="reference"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={t.manualHint}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        /* Not `inputMode: numeric` — the reference has letters in it. */
        className="h-14 w-full min-w-0 border-b border-line bg-transparent text-center font-mono text-[1.0625rem] uppercase tracking-[0.1em] text-night-ink outline-none transition-colors duration-500 placeholder:tracking-[0.1em] placeholder:text-night-ink/20 focus:border-gold"
      />

      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-[0.625rem] uppercase tracking-[0.28em] text-night-ink/40"
        >
          {t.manualBack}
        </button>
        <button
          type="submit"
          disabled={busy}
          className="btn-gold btn-gold-night btn-gold-sm disabled:opacity-40"
        >
          {busy ? t.checking : t.manualCheck}
        </button>
      </div>
    </form>
  );
}

/* A club is loud and a phone is at arm's length. A short buzz for an
   admission, a broken one for anything else — so the doorman knows which way
   it went before they have finished looking down. Ignored by any browser that
   does not do it, which is most desktops and all of iOS. */
function buzz(outcome: RedemptionResult["outcome"]) {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  try {
    navigator.vibrate(outcome === "valid" ? 60 : [70, 60, 70]);
  } catch {
    /* Vibration is a courtesy; a browser refusing it is not an event. */
  }
}
