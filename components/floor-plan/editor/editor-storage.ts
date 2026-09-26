import { reseedUids, type EditorDoc } from "@/components/floor-plan/editor/editor-doc";
import type { FloorId } from "@/lib/floors";

/* Keeping the work safe.
 *
 * DEVELOPMENT ONLY, and deliberately not a backend. This exists so that a
 * reload, a hot module replacement or a week of further work on the editor
 * itself cannot cost somebody a morning of tracing. COPY FLOOR PLAN DATA is
 * still how geometry becomes real — in lib/floor-plan.ts for the ground floor
 * and lib/floor-plan-nivo2.ts for the upstairs; everything here is a net under
 * the tab.
 *
 * TWO RULES THIS FILE EXISTS TO KEEP.
 *
 * The key has not changed and will not change. A draft saved by an older
 * build of the editor is read by this one, and the payload it wrote is still
 * understood — see `parse`, which accepts both the current envelope and the
 * older bare `{ savedAt, doc }`. Renaming the key would orphan real work in
 * somebody's browser with no warning and no way back.
 *
 * The stored data is versioned separately from the editor that made it. The
 * envelope carries `version`, and the editor's own components can be rewritten
 * as often as they like: as long as a document still has objects, nodes and
 * guides it will be restored. Nothing here validates against the *current*
 * shape of a seat, because doing so would make tomorrow's refactor throw away
 * yesterday's tracing. */

/* Unchanged since the first draft was written. Do not rename. */
export const DRAFT_KEY = "plitvice-floor-plan-draft";
export const SNAPSHOT_KEY = "plitvice-floor-plan-snapshots";

/* ── ONE SET OF KEYS PER LEVEL ─────────────────────────────────────────────
 *
 * THE FIRST FLOOR KEEPS THE ORIGINAL KEYS, EXACTLY. Somebody has a morning of
 * tracing in `plitvice-floor-plan-draft` right now; moving the ground floor to
 * a suffixed key would orphan it in their browser with no warning and no way
 * back — which is the one rule the top of this file exists to keep. So the
 * second floor takes a new key and the first floor's is left alone.
 *
 * WHICH ALSO MEANS THE TWO CANNOT OVERWRITE EACH OTHER. Saving while NIVO 2 is
 * open writes the NIVO 2 key and nothing else, and switching levels is reading
 * the other key rather than converting anything. */
const FLOOR_SUFFIX: Record<FloorId, string> = { 1: "", 2: "-l2" };

export const draftKey = (floor: FloorId) => `${DRAFT_KEY}${FLOOR_SUFFIX[floor]}`;
export const snapshotKey = (floor: FloorId) => `${SNAPSHOT_KEY}${FLOOR_SUFFIX[floor]}`;

export const FORMAT_VERSION = 1;
export const BACKUP_KIND = "plitvice-floor-plan-backup";
export const SNAPSHOT_LIMIT = 20;

export type Envelope = {
  version: number;
  savedAt: string;
  /* Which level this document is of, where it was written down. Absent on
     every draft saved before there was a second floor, which is exactly what
     it should be: they are all the ground floor. */
  floor?: FloorId;
  floorPlan: EditorDoc;
};

export type Snapshot = Envelope & { id: string; label: string };

/* A document is worth restoring if it has the three collections the editor
   works on. Anything beyond that is left to the editor to interpret, so a new
   field on a seat never invalidates an old save. */
function validDoc(value: unknown): EditorDoc | null {
  if (!value || typeof value !== "object") return null;
  const d = value as Partial<EditorDoc>;
  if (!Array.isArray(d.objects)) return null;
  if (!d.nodes || typeof d.nodes !== "object" || Array.isArray(d.nodes)) return null;
  return {
    objects: d.objects,
    nodes: d.nodes,
    /* Guides arrived after the first drafts; their absence is not a fault. */
    guides: Array.isArray(d.guides) ? d.guides : [],
  };
}

/* Both shapes the editor has ever written, plus a downloaded backup file. */
export function parse(raw: unknown): Envelope | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  const doc = validDoc(r.floorPlan) ?? validDoc(r.doc);
  if (!doc) return null;

  const savedAt =
    typeof r.savedAt === "string"
      ? r.savedAt
      : typeof r.savedAt === "number"
        ? new Date(r.savedAt).toISOString()
        : new Date().toISOString();

  return {
    version: typeof r.version === "number" ? r.version : 0,
    savedAt,
    floor: r.floor === 2 ? 2 : r.floor === 1 ? 1 : undefined,
    floorPlan: doc,
  };
}

function readJson(key: string): unknown {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    /* Quota, private mode, whatever. The editor carries on without it, and
       says so rather than pretending the work is safe. */
    return false;
  }
}

/* ── the draft ──────────────────────────────────────────────────────────── */

export function readDraft(floor: FloorId = 1): Envelope | null {
  return parse(readJson(draftKey(floor)));
}

export function writeDraft(doc: EditorDoc, floor: FloorId = 1): string | null {
  const savedAt = new Date().toISOString();
  const ok = writeJson(draftKey(floor), {
    version: FORMAT_VERSION,
    savedAt,
    floor,
    floorPlan: doc,
  } satisfies Envelope);
  return ok ? savedAt : null;
}

/* Only ever called behind a confirmation, and only for the level it names. */
export function clearDraft(floor: FloorId = 1) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(draftKey(floor));
  } catch {
    /* nothing to do */
  }
}

/* ── snapshots ──────────────────────────────────────────────────────────── */

export function readSnapshots(floor: FloorId = 1): Snapshot[] {
  const raw = readJson(snapshotKey(floor));
  if (!Array.isArray(raw)) return [];
  const out: Snapshot[] = [];
  for (const entry of raw) {
    const env = parse(entry);
    if (!env) continue;
    const e = entry as Record<string, unknown>;
    out.push({
      ...env,
      id: typeof e.id === "string" ? e.id : String(out.length),
      label: typeof e.label === "string" ? e.label : stamp(env.savedAt),
    });
  }
  return out;
}

/* Newest first, and the newest is never the one that falls off the end. */
export function addSnapshot(doc: EditorDoc, label: string | undefined, floor: FloorId = 1): Snapshot[] {
  const savedAt = new Date().toISOString();
  const snapshot: Snapshot = {
    id: `s${Date.now()}`,
    label: label?.trim() || stamp(savedAt),
    version: FORMAT_VERSION,
    savedAt,
    floor,
    floorPlan: doc,
  };
  const next = [snapshot, ...readSnapshots(floor)].slice(0, SNAPSHOT_LIMIT);
  writeJson(snapshotKey(floor), next);
  return next;
}

export function removeSnapshot(id: string, floor: FloorId = 1): Snapshot[] {
  const next = readSnapshots(floor).filter((s) => s.id !== id);
  writeJson(snapshotKey(floor), next);
  return next;
}

/* ── backup files ───────────────────────────────────────────────────────── */

export function downloadBackup(doc: EditorDoc, floor: FloorId = 1) {
  if (typeof window === "undefined") return;
  const savedAt = new Date();
  const payload = {
    kind: BACKUP_KIND,
    version: FORMAT_VERSION,
    savedAt: savedAt.toISOString(),
    /* Stamped with the level it came off, so a file restored a month later
       cannot be poured onto the wrong floor by accident. */
    floor,
    floorPlan: doc,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `plitvice-floor-plan-nivo${floor}-backup-${savedAt.toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* A file is read and checked all the way through before anything is replaced;
   a bad file leaves the current work exactly where it was. */
export async function readBackupFile(file: File): Promise<Envelope> {
  const text = await file.text();
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("That file is not JSON.");
  }
  const env = parse(raw);
  if (!env) throw new Error("No floor plan in that file — nothing was changed.");
  if (env.floorPlan.objects.length === 0) {
    throw new Error("That backup holds no objects — nothing was changed.");
  }
  return { ...env, floorPlan: reseedUids(env.floorPlan) };
}

/* ── formatting ─────────────────────────────────────────────────────────── */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function stamp(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "unknown";
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes(),
  ).padStart(2, "0")}`;
}

export function clockOf(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "--:--";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function countOf(doc: EditorDoc) {
  const seats = doc.objects.filter((o) => o.kind === "seat").length;
  return `${seats} tables · ${doc.objects.length} objects`;
}
