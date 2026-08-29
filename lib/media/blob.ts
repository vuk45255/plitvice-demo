import type { MediaProvider, StoredMedia } from "@/lib/media/provider";

/* VERCEL BLOB, OVER ITS DOCUMENTED HTTP ENDPOINT.
 *
 * No SDK. The same choice the mail provider made about Resend, for the same
 * two reasons: one PUT and one DELETE is not worth a dependency, and a package
 * that wraps an HTTP call is a package that can break the build of a system
 * whose entire job is to still be running on Saturday night.
 *
 * WHAT VERCEL GIVES US. Attaching a Blob store to the project sets
 * BLOB_READ_WRITE_TOKEN in the environment by itself; nothing else has to be
 * configured, and the URL that comes back is already public and already on a
 * CDN. That is why this is the recommended store for this deployment.
 *
 * `addRandomSuffix: false` is deliberate: the key we generated is the key we
 * want, because the event row records it in order to be able to delete the
 * object later. A suffix invented by the server would make our stored key a
 * lie. Overwriting is therefore possible in principle and impossible in
 * practice — every key carries 128 bits of our own randomness. */

const API = "https://blob.vercel-storage.com";

function token(): string {
  const value = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (!value) throw new Error("BLOB_READ_WRITE_TOKEN nije podešen.");
  return value;
}

export const vercelBlobProvider: MediaProvider = {
  id: "vercel-blob",

  async put({ key, body, contentType }): Promise<StoredMedia> {
    const response = await fetch(`${API}/${encodeURI(key)}`, {
      method: "PUT",
      headers: {
        authorization: `Bearer ${token()}`,
        "x-api-version": "7",
        "x-content-type": contentType,
        "x-add-random-suffix": "0",
        /* A poster does not change under its key, so it may be cached hard.
           A NEW poster is a NEW key, which is what makes that safe. */
        "x-cache-control-max-age": "31536000",
      },
      body: body as unknown as BodyInit,
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(
        `Vercel Blob je odbio otpremanje (${response.status}). ${await reason(response)}`,
      );
    }

    const payload = (await response.json()) as { url?: string; downloadUrl?: string };
    const url = payload.url ?? payload.downloadUrl;
    if (!url) throw new Error("Vercel Blob nije vratio adresu datoteke.");

    return { key, url };
  },

  async remove(key: string): Promise<void> {
    /* The delete endpoint takes the URL rather than the key, and we do not
       keep the URL of a poster we are replacing separately from the row that
       is about to be overwritten — so the caller passes what it has. Both a
       key and a full URL are accepted here; a key is resolved against the
       store's own listing, which is one request and only ever happens when a
       poster is replaced. */
    const target = key.startsWith("http") ? key : await lookup(key);
    if (!target) return;

    await fetch(`${API}/delete`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token()}`,
        "x-api-version": "7",
        "content-type": "application/json",
      },
      body: JSON.stringify({ urls: [target] }),
      cache: "no-store",
    });
  },
};

/* The one read this provider does. Returns undefined rather than throwing: a
   poster that is not in the bucket is a poster that does not need deleting. */
async function lookup(key: string): Promise<string | undefined> {
  const response = await fetch(`${API}/?prefix=${encodeURIComponent(key)}&limit=1`, {
    headers: { authorization: `Bearer ${token()}`, "x-api-version": "7" },
    cache: "no-store",
  });
  if (!response.ok) return undefined;
  const payload = (await response.json()) as { blobs?: { pathname: string; url: string }[] };
  return payload.blobs?.find((blob) => blob.pathname === key)?.url;
}

async function reason(response: Response): Promise<string> {
  try {
    const said = await response.text();
    return said.slice(0, 200);
  } catch {
    return "";
  }
}
