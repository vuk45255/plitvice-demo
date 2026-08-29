/* WHERE AN UPLOADED FILE ACTUALLY GOES.
 *
 * The same shape as the payment boundary in lib/ticketing/payments and the mail
 * boundary in lib/mail, for the same reason: the club has not chosen an object
 * store yet, and the wrong moment to find that out is the night somebody
 * uploads a poster.
 *
 * ═══ WHICH ONE RUNS ═══════════════════════════════════════════════════════
 *
 *   MEDIA_STORE=vercel-blob → Vercel Blob, over its documented HTTP endpoint.
 *                             Needs BLOB_READ_WRITE_TOKEN (Vercel sets this
 *                             itself when a Blob store is attached).
 *   MEDIA_STORE=s3          → anything that speaks S3: Cloudflare R2, Backblaze
 *                             B2, MinIO, AWS itself. Needs S3_BUCKET,
 *                             S3_ENDPOINT, S3_REGION, S3_ACCESS_KEY_ID,
 *                             S3_SECRET_ACCESS_KEY and S3_PUBLIC_BASE_URL.
 *   MEDIA_STORE=local       → a directory under .data/media, served back by
 *                             /api/media/…. DEVELOPMENT ONLY, and it says so:
 *                             it REFUSES TO START in production rather than
 *                             quietly writing to a disk that disappears.
 *   unset                   → no store. Uploads are refused with a sentence
 *                             naming the variable that would fix it, and
 *                             EVERYTHING ELSE ABOUT AN EVENT STILL WORKS.
 *
 * ═══ WHY UNSET IS A STATE AND NOT A CRASH ═════════════════════════════════
 *
 * A poster is the one part of a night that is not operationally load-bearing:
 * the doors still open, the tickets still scan and the tables still book
 * without one. So a club that has not attached a bucket gets a club that
 * cannot upload posters — not a club that cannot create events. The refusal
 * carries the fix, because "upload failed" at one in the morning is useless.
 *
 * ═══ WHAT A PROVIDER MAY AND MAY NOT DO ═══════════════════════════════════
 *
 * It may throw; the caller turns that into a sentence. It may not decide
 * anything: no provider looks at an event, validates a file, or invents a key.
 * It is handed a key, some bytes and a content type, and returns the URL the
 * bytes are now readable at. Validation is lib/media/images.ts and the key is
 * generated there, because a provider that trusted a filename is a provider
 * that writes `../../../etc/passwd`. */

export type StoredMedia = {
  /* The key the object is filed under, ours and stable. Kept on the event row
     so a replaced poster can be deleted rather than orphaned. */
  key: string;
  /* Where anything may read it. Absolute for a real bucket; a same-origin path
     for the development store. */
  url: string;
};

export type MediaProvider = {
  id: string;
  put(input: {
    key: string;
    body: Uint8Array;
    contentType: string;
  }): Promise<StoredMedia>;
  /* Best effort by contract: a delete that fails leaves an unreferenced object
     in a bucket, which costs a fraction of a cent and breaks nothing. Callers
     must never let it fail the operation that prompted it. */
  remove(key: string): Promise<void>;
};

export type MediaStoreName = "vercel-blob" | "s3" | "local" | "none";

export function mediaStoreName(): MediaStoreName {
  const raw = process.env.MEDIA_STORE?.trim().toLowerCase();
  if (!raw || raw === "none") return "none";
  if (raw === "vercel-blob" || raw === "blob" || raw === "vercel") return "vercel-blob";
  if (raw === "s3" || raw === "r2") return "s3";
  if (raw === "local") return "local";
  return "none";
}

/* Whether uploading is possible at all right now, and if not, what to say.
 *
 * ═══ TWO SENTENCES, FOR TWO DIFFERENT PEOPLE ══════════════════════════════
 *
 * `reason` is what the club's manager reads on the screen at one in the
 * morning. It says that pictures cannot be uploaded and what to do instead. It
 * never contains the name of an environment variable, a storage product or a
 * provider, because none of those are things a person running a nightclub has,
 * can change, or should be made to feel responsible for. A screen that says
 * "MEDIA_STORE nije podešen" to a club owner is a screen that has confused its
 * own plumbing for the user's problem.
 *
 * `detail` is the same fact for whoever deploys this. It names the variable, it
 * is written in English like every other operational string, and it goes to the
 * server log and to .env.example — never to a screen.
 *
 * The admin screen asks this so it can show the upload control as unavailable
 * with a reason, instead of offering a button that always fails. */
export type MediaReadiness =
  | { ready: true; store: MediaStoreName }
  | {
      /* For staff. Plain Serbian, no infrastructure. */
      ready: false;
      store: MediaStoreName;
      reason: string;
      /* For whoever configures the deployment. Logged, never rendered. */
      detail: string;
    };

/* The one sentence a member of staff ever sees about this. It is the same
   whatever is actually wrong, because every cause has the same consequence for
   them and the same thing to do about it. */
const STAFF_REASON =
  "Postavljanje slike trenutno nije dostupno. Poster možete uneti kao putanju " +
  "do postojeće slike, a sve ostalo na večeru radi normalno.";

export function mediaReadiness(): MediaReadiness {
  const store = mediaStoreName();

  if (store === "none") {
    return {
      ready: false,
      store,
      reason: STAFF_REASON,
      detail:
        "No media store configured. Set MEDIA_STORE to vercel-blob, s3 or local " +
        "(see .env.example).",
    };
  }

  if (store === "vercel-blob" && !process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
    return {
      ready: false,
      store,
      reason: STAFF_REASON,
      detail: "MEDIA_STORE=vercel-blob but BLOB_READ_WRITE_TOKEN is not set.",
    };
  }

  if (store === "s3") {
    const missing = [
      "S3_BUCKET",
      "S3_ENDPOINT",
      "S3_ACCESS_KEY_ID",
      "S3_SECRET_ACCESS_KEY",
      "S3_PUBLIC_BASE_URL",
    ].filter((name) => !process.env[name]?.trim());
    if (missing.length > 0) {
      return {
        ready: false,
        store,
        reason: STAFF_REASON,
        detail: `MEDIA_STORE=s3 but missing: ${missing.join(", ")}.`,
      };
    }
  }

  /* ═══ THE ONE REFUSAL THAT IS NOT ABOUT CONFIGURATION ══════════════════
   *
   * A serverless function's filesystem is a scratch pad: it is not shared
   * between the instances serving the same site, and it is gone when the
   * instance is recycled. A poster written there is a poster that appears for
   * some visitors, for a while — which is worse than no poster at all, because
   * it looks like it worked. So the local store is refused in production
   * loudly rather than allowed to half-work. */
  if (store === "local" && process.env.NODE_ENV === "production") {
    return {
      ready: false,
      store,
      reason: STAFF_REASON,
      detail:
        "MEDIA_STORE=local cannot run in production — files on the server do not " +
        "survive a restart. Configure vercel-blob or s3.",
    };
  }

  return { ready: true, store };
}

/* Imported dynamically so a deployment on one store never loads the others,
   and so adding a store is adding a file. */
export async function activeMediaProvider(): Promise<MediaProvider> {
  const state = mediaReadiness();
  /* The OPERATOR's sentence, because this throw ends up in a server log and
     never in front of anybody in the club. */
  if (!state.ready) throw new Error(state.detail);

  if (state.store === "vercel-blob") {
    const { vercelBlobProvider } = await import("@/lib/media/blob");
    return vercelBlobProvider;
  }
  if (state.store === "s3") {
    const { s3Provider } = await import("@/lib/media/s3");
    return s3Provider;
  }
  const { localMediaProvider } = await import("@/lib/media/local");
  return localMediaProvider;
}
