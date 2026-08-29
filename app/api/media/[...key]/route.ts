import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { localMediaPath } from "@/lib/media/local";
import { mediaStoreName } from "@/lib/media/provider";

/* READING BACK WHAT THE DEVELOPMENT STORE WROTE — and nothing else.
 *
 * This route exists so that `MEDIA_STORE=local` is a real, working store on a
 * laptop rather than a stub: a poster uploaded in development is visible in the
 * admin list, in the preview and anywhere else the URL is rendered.
 *
 * ═══ WHY IT IS NOT A GENERAL FILE SERVER ══════════════════════════════════
 *
 * It answers 404 for every request unless MEDIA_STORE is `local`. On any real
 * deployment the posters are on a CDN and this route is dead — so it should
 * behave as if it does not exist, rather than being a second, slower way to
 * read files off a server that also happens to run the database.
 *
 * The key is resolved through `localMediaPath`, which refuses anything that
 * escapes `.data/media`. A traversal attempt is a 404 like any other missing
 * file: the request is told nothing about what is or is not there.
 *
 * ═══ WHY THE CONTENT TYPE IS NOT GUESSED FROM THE PATH ════════════════════
 *
 * It is derived from the extension the UPLOADER wrote, which came from the
 * sniffed format in lib/media/images.ts and not from anything a client sent —
 * and anything unrecognised is served as `application/octet-stream`, which a
 * browser downloads rather than executes. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string[] }> },
) {
  if (mediaStoreName() !== "local") {
    return new NextResponse(null, { status: 404 });
  }

  const { key } = await params;
  const joined = key.join("/");

  try {
    const bytes = await readFile(localMediaPath(joined));
    const ext = joined.split(".").pop()?.toLowerCase() ?? "";
    return new NextResponse(bytes as unknown as BodyInit, {
      headers: {
        "content-type": TYPES[ext] ?? "application/octet-stream",
        /* Every key carries its own randomness, so a given key's bytes never
           change and may be cached for as long as anything likes. */
        "cache-control": "public, max-age=31536000, immutable",
        "content-disposition": "inline",
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
