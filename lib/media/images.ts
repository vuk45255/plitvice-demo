import { randomBytes } from "node:crypto";
import { activeMediaProvider, mediaReadiness, type StoredMedia } from "@/lib/media/provider";

/* WHAT MAY BE UPLOADED, AND UNDER WHAT NAME.
 *
 * Every judgement about a file is made here, on the server, before a provider
 * is ever asked to store anything. The provider does not validate — it is a
 * pipe — so this is the only place that decides, and there is one of it.
 *
 * ═══ THE FOUR RULES ═══════════════════════════════════════════════════════
 *
 * 1. THE TYPE IS AN ALLOWLIST, NEVER A DENYLIST. Four image formats. Anything
 *    that is not one of them is refused, so nothing has to be maintained as
 *    attackers invent new things to send.
 *
 * 2. THE BYTES ARE SNIFFED, NOT THE HEADER. A browser's `Content-Type` and a
 *    file's extension are both written by whoever is uploading. A .jpg that
 *    begins `<?php` or `<svg onload=…>` is refused because the first eight
 *    bytes are read and compared against the format's own signature. SVG is
 *    NOT in the list precisely because it is a document that can carry script,
 *    and a poster is never worth that.
 *
 * 3. THE CLIENT'S FILENAME IS NEVER A PATH, AND NEVER PART OF ONE. The key is
 *    generated here out of the event's id and 128 bits of randomness, and the
 *    extension comes from the SNIFFED format rather than from what was typed.
 *    `../../.env`, a name with a null byte in it and a 400-character name are
 *    all simply discarded — there is nothing to sanitise, because nothing the
 *    client sent is used.
 *
 * 4. THE SIZE IS CAPPED BEFORE ANYTHING IS READ INTO MEMORY. A poster is a
 *    poster; eight megabytes is a very generous one, and a serverless function
 *    that reads an arbitrary upload into a buffer is a function that can be
 *    stopped by anybody with a large file.
 *
 * ═══ WHAT IS DELIBERATELY NOT HERE ════════════════════════════════════════
 *
 * RE-ENCODING AND RESIZING. It would need a native image library — `sharp` is
 * the usual answer — which is a heavy binary dependency in a serverless bundle,
 * and every re-encode is a chance to visibly soften artwork the club paid a
 * designer for. Instead the original bytes are stored exactly as uploaded and
 * `next/image` does the resizing at render time, which is what it is for. The
 * day the club wants a hard 1080×1350 export for Instagram, it belongs here as
 * a second function beside this one and nothing that calls this has to change. */

export const MAX_POSTER_BYTES = 8 * 1024 * 1024;

/* The four formats a poster may be in, each with the bytes it must actually
   begin with. Order matters only for readability. */
const FORMATS: {
  mime: string;
  ext: string;
  matches: (bytes: Uint8Array) => boolean;
}[] = [
  {
    mime: "image/jpeg",
    ext: "jpg",
    matches: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    mime: "image/png",
    ext: "png",
    matches: (b) =>
      b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
      b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a,
  },
  {
    /* "RIFF" …four bytes of length… "WEBP" */
    mime: "image/webp",
    ext: "webp",
    matches: (b) => ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 12) === "WEBP",
  },
  {
    /* An ISO base-media file whose brand says avif: "….ftypavif" */
    mime: "image/avif",
    ext: "avif",
    matches: (b) => ascii(b, 4, 8) === "ftyp" && ascii(b, 8, 12).startsWith("avi"),
  },
];

export const ACCEPTED_MIME = FORMATS.map((f) => f.mime);

const ascii = (bytes: Uint8Array, from: number, to: number) =>
  String.fromCharCode(...bytes.slice(from, to));

export type PosterRefusal =
  | { ok: false; reason: "no-store"; message: string }
  | { ok: false; reason: "empty"; message: string }
  | { ok: false; reason: "too-large"; message: string }
  | { ok: false; reason: "unsupported"; message: string }
  | { ok: false; reason: "failed"; message: string };

export type PosterResult = { ok: true; media: StoredMedia } | PosterRefusal;

/* The one door a poster comes in through.
 *
 * `ownerId` is the event the poster belongs to and is used only to shape the
 * key, so a bucket read by a person stays legible. It is the EVENT'S OWN ID,
 * which the server looked up — never anything a form said. */
export async function storePoster(
  file: File,
  ownerId: string,
): Promise<PosterResult> {
  const state = mediaReadiness();
  if (!state.ready) {
    /* THE SCREEN GETS THE SENTENCE, THE LOG GETS THE VARIABLE. A club manager
       cannot fix a missing bucket and should not be shown one; whoever deploys
       this can, and reads the server output. */
    console.error(`[media] upload refused — ${state.detail}`);
    return { ok: false, reason: "no-store", message: state.reason };
  }

  if (!file || file.size === 0) {
    return { ok: false, reason: "empty", message: "Datoteka je prazna." };
  }

  /* Checked against the declared size FIRST, so an oversized upload is refused
     before its bytes are pulled into memory. */
  if (file.size > MAX_POSTER_BYTES) {
    return {
      ok: false,
      reason: "too-large",
      message: `Slika je prevelika (${megabytes(file.size)} MB). Najviše ${megabytes(MAX_POSTER_BYTES)} MB.`,
    };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  /* And again against what actually arrived, because `size` is a claim. */
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_POSTER_BYTES) {
    return {
      ok: false,
      reason: "too-large",
      message: `Slika je prevelika. Najviše ${megabytes(MAX_POSTER_BYTES)} MB.`,
    };
  }

  const format = FORMATS.find((candidate) => candidate.matches(bytes));
  if (!format) {
    return {
      ok: false,
      reason: "unsupported",
      message: "Podržani su JPG, PNG, WEBP i AVIF. Izaberite sliku u jednom od tih formata.",
    };
  }

  try {
    const provider = await activeMediaProvider();
    const media = await provider.put({
      key: posterKey(ownerId, format.ext),
      body: bytes,
      contentType: format.mime,
    });
    return { ok: true, media };
  } catch (error: unknown) {
    /* The provider's own words are useful to whoever is configuring the store
       and useless to a person uploading a poster, so both happen: the sentence
       goes to the screen, the detail goes to the server's log. */
    console.error("[media] poster upload failed", error);
    return {
      ok: false,
      reason: "failed",
      message: "Otpremanje nije uspelo. Pokušajte ponovo.",
    };
  }
}

/* Throwing away a poster nobody points at any more. NEVER let this fail the
   thing that prompted it: an object left in a bucket costs a fraction of a
   cent, and an event that would not save because a delete timed out costs a
   Saturday night. */
export async function forgetPoster(key: string | undefined): Promise<void> {
  if (!key) return;
  try {
    const provider = await activeMediaProvider();
    await provider.remove(key);
  } catch (error: unknown) {
    console.error("[media] poster delete failed", error);
  }
}

/* `events/<id>/poster-<32 hex>.jpg` — legible in a bucket listing, impossible
   to collide with, and containing nothing anybody typed. */
export function posterKey(ownerId: string, ext: string): string {
  const owner = ownerId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40) || "event";
  return `events/${owner}/poster-${randomBytes(16).toString("hex")}.${ext}`;
}

const megabytes = (bytes: number) => (bytes / (1024 * 1024)).toFixed(1);
