import { createHash, createHmac } from "node:crypto";
import type { MediaProvider, StoredMedia } from "@/lib/media/provider";

/* ANYTHING THAT SPEAKS S3 — Cloudflare R2, Backblaze B2, MinIO, AWS itself.
 *
 * One PUT, one DELETE, and about sixty lines of Signature Version 4. No SDK:
 * the AWS client is tens of megabytes of code that would be bundled into a
 * serverless function whose whole job is to move one JPEG, and the signing
 * algorithm is public, stable since 2012, and shorter than the wrapper.
 *
 * ═══ WHAT HAS TO BE CONFIGURED ════════════════════════════════════════════
 *
 *   S3_BUCKET             the bucket name
 *   S3_ENDPOINT           https://<account>.r2.cloudflarestorage.com  (R2)
 *                         https://s3.<region>.amazonaws.com           (AWS)
 *   S3_REGION             "auto" for R2; the real region for AWS
 *   S3_ACCESS_KEY_ID      /  S3_SECRET_ACCESS_KEY
 *   S3_PUBLIC_BASE_URL    where the objects are READ from — a CDN or a public
 *                         bucket domain. Deliberately separate from the
 *                         endpoint, because on R2 they are never the same host
 *                         and writing to the API domain while linking to it is
 *                         the single most common way to end up with posters
 *                         that 403 for guests.
 *
 * ═══ WHAT THIS DOES NOT DO ════════════════════════════════════════════════
 *
 * No ACLs are sent. Public readability is a property of the bucket and of the
 * CDN in front of it, configured once by whoever owns the account — not
 * something an application should be flipping per object. */

type Config = {
  bucket: string;
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBase: string;
};

function config(): Config {
  const need = (name: string) => {
    const value = process.env[name]?.trim();
    if (!value) throw new Error(`${name} nije podešen.`);
    return value;
  };
  return {
    bucket: need("S3_BUCKET"),
    endpoint: need("S3_ENDPOINT").replace(/\/+$/, ""),
    region: process.env.S3_REGION?.trim() || "auto",
    accessKeyId: need("S3_ACCESS_KEY_ID"),
    secretAccessKey: need("S3_SECRET_ACCESS_KEY"),
    publicBase: need("S3_PUBLIC_BASE_URL").replace(/\/+$/, ""),
  };
}

export const s3Provider: MediaProvider = {
  id: "s3",

  async put({ key, body, contentType }): Promise<StoredMedia> {
    const cfg = config();
    const response = await send(cfg, "PUT", key, body, {
      "content-type": contentType,
      "cache-control": "public, max-age=31536000, immutable",
    });

    if (!response.ok) {
      throw new Error(
        `Skladište je odbilo otpremanje (${response.status}). ${(await response.text()).slice(0, 200)}`,
      );
    }

    return { key, url: `${cfg.publicBase}/${key}` };
  },

  async remove(key: string): Promise<void> {
    const cfg = config();
    /* A key is what we stored; a full URL is what a legacy row might carry.
       Anything that is not ours to delete is left alone. */
    const target = key.startsWith("http")
      ? key.startsWith(cfg.publicBase)
        ? key.slice(cfg.publicBase.length + 1)
        : undefined
      : key;
    if (!target) return;
    await send(cfg, "DELETE", target, new Uint8Array(), {});
  },
};

/* ── signature version 4 ─────────────────────────────────────────────────── */

async function send(
  cfg: Config,
  method: "PUT" | "DELETE",
  key: string,
  body: Uint8Array,
  extraHeaders: Record<string, string>,
): Promise<Response> {
  const url = new URL(`${cfg.endpoint}/${cfg.bucket}/${encodeKey(key)}`);
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256Hex(body);

  const headers: Record<string, string> = {
    ...extraHeaders,
    host: url.host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  };

  /* Canonical headers are sorted, lower-cased and trimmed — the signature is
     over this exact text, so anything that differs by a space does not match. */
  const names = Object.keys(headers)
    .map((name) => name.toLowerCase())
    .sort();
  const canonicalHeaders = names
    .map((name) => `${name}:${String(headers[name] ?? headersLookup(headers, name)).trim()}\n`)
    .join("");
  const signedHeaders = names.join(";");

  const canonicalRequest = [
    method,
    url.pathname,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const scope = `${dateStamp}/${cfg.region}/s3/aws4_request`;
  const toSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    sha256Hex(Buffer.from(canonicalRequest, "utf8")),
  ].join("\n");

  const signingKey = ["aws4_request", "s3", cfg.region, dateStamp].reduceRight(
    (previous, part) => hmac(previous, part),
    Buffer.from(`AWS4${cfg.secretAccessKey}`, "utf8") as Buffer,
  );

  const signature = hmac(signingKey, toSign).toString("hex");

  return fetch(url, {
    method,
    headers: {
      ...headers,
      authorization:
        `AWS4-HMAC-SHA256 Credential=${cfg.accessKeyId}/${scope}, ` +
        `SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
    body: method === "PUT" ? (body as unknown as BodyInit) : undefined,
    cache: "no-store",
  });
}

function headersLookup(headers: Record<string, string>, lower: string): string {
  const found = Object.entries(headers).find(([name]) => name.toLowerCase() === lower);
  return found ? found[1] : "";
}

/* Every segment escaped, and the slashes kept — an object key may contain them
   and they are path separators in the canonical URI, not data. */
const encodeKey = (key: string) =>
  key.split("/").map((part) => encodeURIComponent(part)).join("/");

const sha256Hex = (body: Uint8Array) =>
  createHash("sha256").update(body).digest("hex");

const hmac = (key: Buffer, value: string) =>
  createHmac("sha256", key).update(value, "utf8").digest();
