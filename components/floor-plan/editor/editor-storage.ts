import { reseedUids, type EditorDoc } from "@/components/floor-plan/editor/editor-doc";

/* Keeping the work safe.
 *
 * DEVELOPMENT ONLY, and deliberately not a backend. This exists so that a
 * reload, a hot module replacement or a week of further work on the editor
 * itself cannot cost somebody a morning of tracing. COPY FLOOR PLAN DATA is
 * still how geometry becomes real in lib/floor-plan.ts; everything here is a
 * net under the tab.
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

export const FORMAT_VERSION = 1;
export const BACKUP_KIND = "plitvice-floor-plan-backup";
export const SNAPSHOT_LIMIT = 20;

export type Envelope = {
  version: number;
  savedAt: string;
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

export function readDraft(): Envelope | null {
  return parse(readJson(DRAFT_KEY));
}

export function writeDraft(doc: EditorDoc): string | null {
  const savedAt = new Date().toISOString();
  const ok = writeJson(DRAFT_KEY, {
    version: FORMAT_VERSION,
    savedAt,
    floorPlan: doc,
  } satisfies Envelope);
  return ok ? savedAt : null;
}

/* Only ever called behind a confirmation. */
export function clearDraft() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* nothing to do */
  }
}

/* ── snapshots ──────────────────────────────────────────────────────────── */

export function readSnapshots(): Snapshot[] {
  const raw = readJson(SNAPSHOT_KEY);
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
export function addSnapshot(doc: EditorDoc, label?: string): Snapshot[] {
  const savedAt = new Date().toISOString();
  const snapshot: Snapshot = {
    id: `s${Date.now()}`,
    label: label?.trim() || stamp(savedAt),
    version: FORMAT_VERSION,
    savedAt,
    floorPlan: doc,
  };
  const next = [snapshot, ...readSnapshots()].slice(0, SNAPSHOT_LIMIT);
  writeJson(SNAPSHOT_KEY, next);
  return next;
}

export function removeSnapshot(id: string): Snapshot[] {
  const next = readSnapshots().filter((s) => s.id !== id);
  writeJson(SNAPSHOT_KEY, next);
  return next;
}

/* ── backup files ───────────────────────────────────────────────────────── */

export function downloadBackup(doc: EditorDoc) {
  if (typeof window === "undefined") return;
  const savedAt = new Date();
  const payload = {
    kind: BACKUP_KIND,
    version: FORMAT_VERSION,
    savedAt: savedAt.toISOString(),
    floorPlan: doc,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `plitvice-floor-plan-backup-${savedAt.toISOString().slice(0, 10)}.json`;
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
