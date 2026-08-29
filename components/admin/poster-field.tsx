"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Upload } from "lucide-react";

/* THE POSTER, CHOSEN FROM WHATEVER DEVICE SOMEBODY IS HOLDING.
 *
 * ═══ IT IS A PLAIN FILE INPUT, AND THAT IS THE DESIGN ═════════════════════
 *
 *   <input type="file" accept="image/*">
 *
 * On a laptop that is the system's file dialog. On a phone it is the operating
 * system's own sheet — Photos, Files, and "Take Photo" where the device offers
 * a camera — with no permission prompt of our own and nothing to go wrong on a
 * browser nobody tested. `accept="image/*"` is what makes iOS and Android show
 * the gallery rather than a document browser.
 *
 * A CUSTOM GALLERY WOULD BE WORSE IN EVERY WAY. It cannot read the phone's
 * photo library, it cannot open the camera, it needs permissions, it breaks on
 * the browser version the club's manager actually has, and it is a great deal
 * of code to be worse than a control the platform already ships. So the input
 * is real, focusable and keyboard-operable; only its appearance is ours, and
 * the label around it is what gets tapped.
 *
 * Drag-and-drop is added on top for a laptop, because it is fifteen lines and
 * costs a phone nothing. It is an enhancement: everything works without it.
 *
 * ═══ THE PREVIEW IS LOCAL AND COSTS NOTHING ═══════════════════════════════
 *
 * `URL.createObjectURL` shows the chosen file instantly, out of the browser's
 * own memory, before a single byte has been uploaded. So somebody sees what
 * they picked immediately even on one bar of signal, and a wrong photograph is
 * caught before it is sent rather than after.
 *
 * NOTHING IS UPLOADED HERE. The file rides along with the form and is stored by
 * the server action when the night is saved — one round trip, and no orphaned
 * objects in a bucket from a form somebody abandoned.
 *
 * ═══ WHAT THIS CHECKS, AND WHAT IT DOES NOT ═══════════════════════════════
 *
 * It checks the type and the size so somebody is told about a 40MB HEIC before
 * they wait for it to upload. That is a COURTESY. The judgement that counts is
 * on the server in lib/media/images.ts, which sniffs the actual bytes rather
 * than believing a browser's content type — this component cannot be trusted,
 * because anybody can post to a server action without it. */

const MAX_BYTES = 8 * 1024 * 1024;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/avif"];

export function PosterField({
  currentUrl,
  disabledReason,
}: {
  /* The poster already on the night, if there is one. */
  currentUrl?: string;
  /* Set when pictures cannot be stored. The control still renders — inert,
     with the sentence — rather than vanishing, because a missing upload box is
     something staff report as broken and a stated reason is something they can
     read and get on with. The sentence comes from lib/media/provider.ts and is
     deliberately free of infrastructure: what is actually misconfigured is in
     the server log, where the person who can fix it is looking. */
  disabledReason?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | undefined>(currentUrl);
  const [chosen, setChosen] = useState(false);
  const [removed, setRemoved] = useState(false);
  const [problem, setProblem] = useState<string | undefined>();
  const [dragging, setDragging] = useState(false);

  /* The object URL is released when it is replaced or the component goes away.
     A page where somebody tries six posters otherwise holds six images in
     memory until it is closed. */
  useEffect(() => {
    return () => {
      if (preview && preview.startsWith("blob:")) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function take(file: File | undefined) {
    if (!file) return;

    if (!ACCEPTED.includes(file.type)) {
      setProblem("Podržani su JPG, PNG, WEBP i AVIF.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setProblem(
        `Slika je prevelika (${(file.size / 1024 / 1024).toFixed(1)} MB). Najviše 8 MB.`,
      );
      return;
    }

    setProblem(undefined);
    setPreview((old) => {
      if (old?.startsWith("blob:")) URL.revokeObjectURL(old);
      return URL.createObjectURL(file);
    });
    setChosen(true);
    setRemoved(false);
  }

  /* Dropping a file has to be written INTO the input, not just previewed —
     otherwise the form posts nothing and the preview is a lie. `DataTransfer`
     is how a file list is constructed by hand. */
  function drop(event: React.DragEvent) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (!file || !input.current) return;
    const carrier = new DataTransfer();
    carrier.items.add(file);
    input.current.files = carrier.files;
    take(file);
  }

  function clear() {
    if (input.current) input.current.value = "";
    setPreview((old) => {
      if (old?.startsWith("blob:")) URL.revokeObjectURL(old);
      return undefined;
    });
    setChosen(false);
    /* Only a poster that was ALREADY on the night needs the server told to
       remove it. Clearing a file that was never saved is just clearing. */
    setRemoved(Boolean(currentUrl));
    setProblem(undefined);
  }

  const disabled = Boolean(disabledReason);

  return (
    <div className="sm:col-span-2">
      {/* Posted only when an existing poster is being taken away, so an
          ordinary save never carries a removal instruction. */}
      {removed ? <input type="hidden" name="posterRemove" value="1" /> : null}

      <div className="grid gap-4 sm:grid-cols-[16rem_1fr] sm:items-start">
        {preview ? (
          <div className="adm-poster-preview">
            {/* A plain <img>: the source is a blob: URL from this browser or a
                URL from an object store nobody has told next/image about, and
                an optimiser cannot help with either. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Poster događaja" />
          </div>
        ) : (
          <label
            className={`adm-drop relative ${dragging ? "adm-drop--over" : ""} ${
              disabled ? "pointer-events-none opacity-50" : ""
            }`}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={drop}
          >
            <ImagePlus className="h-6 w-6" aria-hidden="true" />
            <span className="text-[0.8125rem] text-[var(--adm-ink-2)]">
              Dodaj poster
            </span>
            <span className="text-[0.6875rem] leading-relaxed text-[var(--adm-ink-4)]">
              Sa telefona iz galerije, sa računara prevlačenjem ili klikom.
              <br />
              JPG, PNG, WEBP ili AVIF · najviše 8 MB
            </span>
            <input
              ref={input}
              type="file"
              name="poster"
              accept="image/*"
              disabled={disabled}
              onChange={(event) => take(event.currentTarget.files?.[0])}
            />
          </label>
        )}

        <div className="min-w-0">
          {/* When a preview is showing, the input has to stay mounted — it is
              what carries the bytes — so it lives here behind a labelled
              button that reads as PROMENI SLIKU. */}
          {preview ? (
            <div className="flex flex-wrap items-center gap-2">
              <label className="adm-btn adm-btn--sm relative cursor-pointer">
                <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                Promeni sliku
                <input
                  ref={input}
                  type="file"
                  name="poster"
                  accept="image/*"
                  disabled={disabled}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  onChange={(event) => take(event.currentTarget.files?.[0])}
                />
              </label>
              <button
                type="button"
                onClick={clear}
                className="adm-btn adm-btn--sm adm-btn--danger"
              >
                Ukloni sliku
              </button>
            </div>
          ) : null}

          <p className="mt-3 text-[0.6875rem] leading-relaxed text-[var(--adm-ink-4)]">
            {disabledReason ??
              (chosen
                ? "Slika se otprema kada sačuvate veče."
                : removed
                  ? "Poster će biti uklonjen kada sačuvate veče."
                  : "Poster se koristi u listi događaja, u pregledu i svuda gde se veče prikazuje.")}
          </p>

          {problem ? (
            <p role="alert" className="mt-2 text-[0.75rem] text-[var(--adm-bad)]">
              {problem}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
