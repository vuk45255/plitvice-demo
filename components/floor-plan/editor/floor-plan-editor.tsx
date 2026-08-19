"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FloorPlan } from "@/components/floor-plan/floor-plan";
import { EditorLayers, groupOf, type GroupKey } from "@/components/floor-plan/editor/editor-layers";
import {
  Btn,
  MultiInspector,
  ObjectInspector,
} from "@/components/floor-plan/editor/editor-inspector";
import {
  bboxOf,
  detachNode,
  docToArchitecture,
  fanArc,
  loadDoc,
  mergeNodes,
  moveObject,
  newUid,
  nextObjectId,
  nextSeatId,
  deleteSegment,
  gapInSegment,
  nodeDegree,
  numberOf,
  pruneNodes,
  segmentCount,
  segmentEnds,
  splitSegment,
  reseedUids,
  seatsOf,
  serializeDoc,
  translateObjects,
  unionBox,
  wallPath,
  wallPoints,
  withZoneMarks,
  type EditorDoc,
  type EditorObject,
  type EditorArrow,
  type EditorFan,
  type EditorLabel,
  type EditorSeat,
  type EditorStairs,
  type EditorWall,
  type EditorZoneMark,
  type XY,
} from "@/components/floor-plan/editor/editor-doc";
import {
  ROW_BAND,
  numberingCounts,
  renumberSeats,
  type RenumberScope,
} from "@/components/floor-plan/editor/editor-numbering";
import {
  alignObjects,
  distributeObjects,
  lockToAngle,
  matchSize,
  nearestNode,
  nearestWallAngle,
  snapAngle,
  snapToGuides,
  spaceObjects,
  type AlignMode,
  type Guide,
} from "@/components/floor-plan/editor/editor-geometry";
import {
  ImportError,
  PersistenceBar,
  RestorePrompt,
  type SaveState,
} from "@/components/floor-plan/editor/editor-persistence";
import {
  addSnapshot,
  clearDraft,
  downloadBackup,
  readBackupFile,
  readDraft,
  readSnapshots,
  removeSnapshot,
  writeDraft,
  type Envelope,
  type Snapshot,
} from "@/components/floor-plan/editor/editor-storage";
import {
  PLAN,
  REFERENCE_IMAGE,
  SEAT_KINDS,
  ZONE_MARK,
  type SeatType,
  type ZoneId,
} from "@/lib/floor-plan";
import { reservedSeats, type Seat } from "@/lib/floor-availability";

/* The floor plan's workbench — development only.
 *
 * The plan is laid out by hand, over the club's own drawing, in exactly the
 * viewBox the reservation map uses: a table dragged to a spot here is at that
 * spot there, same numbers, no rescaling in between.
 *
 * Nothing snaps to a grid. Every magnet answers to something that is actually
 * on the plan — an edge, a centre line, a wall's own bearing, a corner
 * belonging to another wall — and every one of them can be overruled by
 * dragging past it. The club is irregular and stays irregular.
 *
 * Walls do not own their corners; they name them out of a shared pool. Two
 * walls naming the same corner are joined, and stay joined through any drag.
 *
 * Work lives in the tab, with a draft kept in localStorage as a safety net.
 * COPY FLOOR PLAN DATA is still the only way it becomes real, which keeps
 * lib/floor-plan.ts the one source of truth. */

type Tool =
  | "select" | "bar" | "high" | "booth" | "corner"
  | "wall" | "label" | "stairs" | "fan" | "arrow" | "zonemark";

type Drag =
  | { mode: "move"; uids: string[]; fromClient: XY; snapshot: EditorDoc }
  | { mode: "resize"; uid: string; hx: number; hy: number; snapshot: EditorDoc }
  | { mode: "rotate"; uid: string; snapshot: EditorDoc }
  | { mode: "node"; nodeId: string; snapshot: EditorDoc }
  | { mode: "curve"; uid: string; segment: number; snapshot: EditorDoc }
  | { mode: "end"; uid: string; which: 1 | 2; snapshot: EditorDoc }
  | { mode: "refguide"; id: string }
  | { mode: "marquee"; fromClient: XY; additive: boolean }
  | { mode: "pan"; fromClient: XY; view: XY }
  | null;

const TYPE_INK: Record<SeatType, string> = { bar: "#22d3ee", high: "#f472d0", booth: "#facc15" };
const WALL_INK = "#22c55e";
const HISTORY_LIMIT = 100;

const HANDLES: [number, number][] = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0], [1, 0],
  [-1, 1], [0, 1], [1, 1],
];

type Visible = {
  bar: boolean; high: boolean; booth: boolean;
  walls: boolean; structures: boolean; labels: boolean; zoneMarks: boolean;
};
const ALL_VISIBLE: Visible = {
  bar: true, high: true, booth: true,
  walls: true, structures: true, labels: true, zoneMarks: true,
};

export function FloorPlanEditor() {
  const svgRef = useRef<SVGSVGElement>(null);

  /* A draft traced before the zone numerals existed has none, and there is no
     way to draw one that is not there — so every document that arrives is
     given the four defaults if it has none at all. Purely additive: nothing
     already on the plan is read, moved or replaced. */
  const [doc, setDoc] = useState<EditorDoc>(() => withZoneMarks(loadDoc()));
  const [past, setPast] = useState<EditorDoc[]>([]);
  const [future, setFuture] = useState<EditorDoc[]>([]);
  const [sel, setSel] = useState<string[]>([]);
  const [clipboard, setClipboard] = useState<EditorObject[]>([]);

  const [tool, setTool] = useState<Tool>("select");
  /* Which level of a wall chain the pointer is working at: the whole run, one
     segment of it, or its corners. */
  const [wallMode, setWallMode] = useState<"chain" | "segment" | "node">("chain");
  const [segment, setSegment] = useState<{ uid: string; index: number } | null>(null);
  const nodeMode = wallMode === "node";
  const [chain, setChain] = useState<string[]>([]);
  const [ghost, setGhost] = useState<{ point: XY; label: string | null; close: boolean } | null>(null);

  const [drag, setDrag] = useState<Drag>(null);
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });

  const [guides, setGuides] = useState<Guide[]>([]);
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [angleHint, setAngleHint] = useState<{ x: number; y: number; text: string; snapped: boolean } | null>(null);
  const [deltaHint, setDeltaHint] = useState<{ x: number; y: number; dx: number; dy: number } | null>(null);
  const [nodeHint, setNodeHint] = useState<string | null>(null);
  const [spaceDown, setSpaceDown] = useState(false);

  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [showReference, setShowReference] = useState(true);
  const [visible, setVisible] = useState<Visible>(ALL_VISIBLE);
  const [opacity, setOpacity] = useState(0.45);
  const [refFit, setRefFit] = useState<{ x: number; y: number; scale: number }>({ x: 0, y: 0, scale: 1 });
  const [snapWalls, setSnapWalls] = useState(true);
  const [copied, setCopied] = useState(false);
  const [dataOpen, setDataOpen] = useState(false);
  const [layersOpen, setLayersOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  /* B/V/S over the tables while editing. On by default — the numbers are the
     point of a numbering pass — and drawn without pointer events, so nothing
     about selecting or dragging a table changes when they are up. */
  const [showNumbers, setShowNumbers] = useState(true);
  const [renumberOpen, setRenumberOpen] = useState(false);
  const [rowBand, setRowBand] = useState(ROW_BAND);

  /* Read once, as the first state rather than as a correction to it — the
     banner is then simply derived from whether a draft exists and whether it
     has been dealt with. */
  const [draft] = useState<Envelope | null>(() => readDraft());
  const [draftHandled, setDraftHandled] = useState(false);
  const askRestore = draft !== null && !draftHandled;
  const [savedAt, setSavedAt] = useState<string | null>(() => readDraft()?.savedAt ?? null);
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [snapshots, setSnapshots] = useState<Snapshot[]>(() => readSnapshots());
  const [importError, setImportError] = useState<string | null>(null);

  /* Replacing everything on the canvas, from a draft, a snapshot or a file.
     Uids are reseeded first — a restored document may run past the counter the
     code version left behind, and a collision would weld two objects into one. */
  const adopt = useCallback((next: EditorDoc, at: string | null) => {
    setPast((p) => [...p, doc].slice(-HISTORY_LIMIT));
    setFuture([]);
    setDoc(withZoneMarks(reseedUids(next)));
    setSel([]);
    setDraftHandled(true);
    if (at) setSavedAt(at);
    setDirty(false);
  }, [doc]);

  const moveDelta = useRef<XY>({ x: 0, y: 0 });
  const lastStep = useRef<{ uids: string[]; dx: number; dy: number } | null>(null);

  const selSet = useMemo(() => new Set(sel), [sel]);
  const selected = useMemo(
    () => doc.objects.filter((o) => selSet.has(o.uid)),
    [doc, selSet],
  );
  const single = selected.length === 1 ? selected[0] : null;

  /* ── history ──────────────────────────────────────────────────────────── */

  const commit = useCallback(() => {
    setPast((p) => [...p, doc].slice(-HISTORY_LIMIT));
    setFuture([]);
    setDirty(true);
  }, [doc]);

  const undo = useCallback(() => {
    setPast((p) => {
      if (p.length === 0) return p;
      setFuture((f) => [doc, ...f].slice(0, HISTORY_LIMIT));
      setDoc(p[p.length - 1]);
      setDirty(true);
      return p.slice(0, -1);
    });
  }, [doc]);

  const redo = useCallback(() => {
    setFuture((f) => {
      if (f.length === 0) return f;
      setPast((p) => [...p, doc].slice(-HISTORY_LIMIT));
      setDoc(f[0]);
      setDirty(true);
      return f.slice(1);
    });
  }, [doc]);

  /* ── the local draft ──────────────────────────────────────────────────── */

  /* Autosave, held back until the draft question has been answered.
   *
   * While the banner is up the canvas is showing the code version, and the
   * draft on disk is somebody's work. Writing during that window — on any
   * stray edit, undo, or a hot reload that lands mid-session — would quietly
   * overwrite hours of tracing with a file nobody asked for. So nothing is
   * written until CONTINUE SAVED WORK or LOAD CODE VERSION has been chosen. */
  useEffect(() => {
    if (!dirty || askRestore) return;
    const id = window.setTimeout(() => {
      const at = writeDraft(doc);
      if (at) {
        setSavedAt(at);
        setDirty(false);
        setSaveState("saved");
      } else {
        setSaveState("failed");
      }
    }, 700);
    return () => window.clearTimeout(id);
  }, [askRestore, doc, dirty]);

  useEffect(() => {
    const onLeave = (e: BeforeUnloadEvent) => {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [dirty]);

  /* ── coordinates ──────────────────────────────────────────────────────── */

  const toPlan = useCallback(
    (clientX: number, clientY: number): XY => {
      const ctm = svgRef.current?.getScreenCTM();
      if (!ctm) return { x: 0, y: 0 };
      const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
      return { x: (p.x - view.x) / view.scale, y: (p.y - view.y) / view.scale };
    },
    [view],
  );

  const px = (n: number) => n / view.scale;

  /* ── mutation ─────────────────────────────────────────────────────────── */

  const patch = useCallback((uid: string, p: Record<string, unknown>) => {
    setDoc((d) => ({
      ...d,
      objects: d.objects.map((o) => (o.uid === uid ? ({ ...o, ...p } as EditorObject) : o)),
    }));
    setDirty(true);
  }, []);

  const copyInto = (d: EditorDoc, sources: EditorObject[], dx: number, dy: number) => {
    let working = d;
    const made: string[] = [];
    for (const source of sources) {
      const uid = newUid();
      let clone: EditorObject = { ...source, uid };

      if (clone.kind === "wall") {
        /* A copied wall gets corners of its own, or it would drag the original
           about by the nodes they would otherwise share. */
        const nodes = { ...working.nodes };
        const ids = clone.nodes.map((old) => {
          const fresh = newUid();
          const p = working.nodes[old];
          nodes[fresh] = { x: (p?.x ?? 0) + dx, y: (p?.y ?? 0) + dy };
          return fresh;
        });
        clone = { ...clone, nodes: ids, id: nextObjectId(working, "wall", "wall") };
        working = { ...working, nodes };
      } else if (clone.kind === "seat") {
        clone = { ...clone, id: nextSeatId(working, clone.type), x: clone.x + dx, y: clone.y + dy };
      } else if (clone.kind === "spiral") {
        clone = { ...clone, id: nextObjectId(working, "spiral", "spiral"), cx: clone.cx + dx, cy: clone.cy + dy };
      } else if (clone.kind === "passage") {
        clone = { ...clone, x: clone.x + dx, y: clone.y + dy };
      } else if (clone.kind === "arrow") {
        clone = {
          ...clone,
          id: nextObjectId(working, "arrow", "arrow"),
          x1: clone.x1 + dx, y1: clone.y1 + dy,
          x2: clone.x2 + dx, y2: clone.y2 + dy,
        };
      } else {
        /* Labels, straight flights and fans all keep every setting they had —
           size, tread count, sweep, angle — and take only a new name. */
        clone = { ...clone, id: nextObjectId(working, clone.kind, clone.kind), x: clone.x + dx, y: clone.y + dy };
      }

      working = { ...working, objects: [...working.objects, clone] };
      made.push(uid);
    }
    return { doc: working, made };
  };

  /* Duplicating twice in a row repeats whatever move followed the first one —
     one copy nudged into place, then ⌘D again lays the rest of the row out on
     the same pitch. */
  const duplicateSelection = useCallback(() => {
    if (selected.length === 0) return;
    const repeat = lastStep.current;
    const same = repeat && repeat.uids.length === sel.length && repeat.uids.every((u) => selSet.has(u));
    const dx = same ? repeat.dx : 24;
    const dy = same ? repeat.dy : 24;

    commit();
    const { doc: next, made } = copyInto(doc, selected, dx, dy);
    setDoc(next);
    setSel(made);
    lastStep.current = { uids: made, dx, dy };
  }, [commit, doc, sel, selSet, selected]);

  /* In SEGMENT mode Delete takes the one span, not the room it belongs to. */
  const deleteSelection = useCallback(() => {
    if (segment) {
      commit();
      setDoc((d) => deleteSegment(d, segment.uid, segment.index));
      setSegment(null);
      return;
    }
    if (selected.length === 0) return;
    commit();
    setDoc((d) => pruneNodes({ ...d, objects: d.objects.filter((o) => !selSet.has(o.uid)) }));
    setSel([]);
  }, [commit, segment, selSet, selected]);

  const nudge = useCallback(
    (dx: number, dy: number) => {
      if (sel.length === 0) return;
      commit();
      setDoc((d) => translateObjects(d, sel, dx, dy));
    },
    [commit, sel],
  );

  const addSeat = useCallback(
    (kind: "bar" | "high" | "booth" | "corner", at?: XY) => {
      commit();
      const type: SeatType = kind === "corner" ? "booth" : kind;
      const base = SEAT_KINDS[type].size;
      const centre = at ?? {
        x: (PLAN.width / 2 - view.x) / view.scale,
        y: (PLAN.height / 2 - view.y) / view.scale,
      };
      const seat: EditorSeat = {
        uid: newUid(),
        kind: "seat",
        id: nextSeatId(doc, type),
        type,
        zone: 1,
        x: Math.round(centre.x),
        y: Math.round(centre.y),
        w: kind === "corner" ? 90 : base.w,
        h: kind === "corner" ? 70 : base.h,
        rotation: 0,
        ...(kind === "corner" ? { corner: "tl" as const, depth: 20 } : {}),
      };
      setDoc((d) => ({ ...d, objects: [...d.objects, seat] }));
      setSel([seat.uid]);
    },
    [commit, doc, view],
  );

  /* Everything else that can be dropped on the plan. Each gets its own name,
     so a second staircase is simply a second staircase. */
  const addPiece = useCallback(
    (what: "label" | "stairs" | "fan" | "arrow" | "zonemark", at: XY) => {
      commit();
      const uid = newUid();
      let piece: EditorObject;

      if (what === "label") {
        piece = {
          uid, kind: "label", id: nextObjectId(doc, "label", "label"),
          key: "floor.stage", x: Math.round(at.x), y: Math.round(at.y),
          size: "zone", text: "NOVI NATPIS", fontSize: 20, tracking: 0.34,
          rotation: 0, opacity: 1, align: "middle",
        } satisfies EditorLabel;
      } else if (what === "zonemark") {
        piece = {
          uid, kind: "zonemark", id: nextObjectId(doc, "zonemark", "zone"),
          zone: 1, x: Math.round(at.x), y: Math.round(at.y),
          fontSize: ZONE_MARK.fontSize, rotation: ZONE_MARK.rotation,
          opacity: ZONE_MARK.opacity,
        } satisfies EditorZoneMark;
      } else if (what === "stairs") {
        piece = {
          uid, kind: "stairs", id: nextObjectId(doc, "stairs", "stairs"),
          x: Math.round(at.x - 30), y: Math.round(at.y - 45),
          w: 60, h: 90, rotation: 0, steps: 8, direction: "up",
        } satisfies EditorStairs;
      } else if (what === "fan") {
        piece = {
          uid, kind: "fan", id: nextObjectId(doc, "fan", "fan"),
          x: Math.round(at.x - 55), y: Math.round(at.y - 55),
          w: 110, h: 60, rotation: 0, steps: 9, arc: 180,
        } satisfies EditorFan;
      } else {
        piece = {
          uid, kind: "arrow", id: nextObjectId(doc, "arrow", "arrow"),
          x1: Math.round(at.x - 40), y1: Math.round(at.y),
          x2: Math.round(at.x + 40), y2: Math.round(at.y),
          width: 2, head: 12,
        } satisfies EditorArrow;
      }

      setDoc((d) => ({ ...d, objects: [...d.objects, piece] }));
      setSel([uid]);
    },
    [commit, doc],
  );

  /* ── flip, group, style ───────────────────────────────────────────────── */

  const flip = useCallback(
    (axis: "x" | "y") => {
      if (sel.length === 0) return;
      commit();
      setDoc((d) => {
        const bounds = unionBox(
          d.objects.filter((o) => selSet.has(o.uid)).map((o) => bboxOf(o, d.nodes)),
        );
        if (!bounds) return d;
        const mirror = (v: number, lo: number, size: number) => lo + size - (v - lo);

        const nodeIds = new Set<string>();
        for (const o of d.objects) {
          if (selSet.has(o.uid) && !o.locked && o.kind === "wall") {
            for (const id of o.nodes) nodeIds.add(id);
          }
        }
        const nodes = { ...d.nodes };
        for (const id of nodeIds) {
          const n = nodes[id];
          if (!n) continue;
          nodes[id] = axis === "x"
            ? { x: mirror(n.x, bounds.x, bounds.w), y: n.y }
            : { x: n.x, y: mirror(n.y, bounds.y, bounds.h) };
        }

        const objects = d.objects.map((o) => {
          if (!selSet.has(o.uid) || o.locked) return o;
          const b = bboxOf(o, d.nodes);
          if (o.kind === "arrow") {
            return axis === "x"
              ? { ...o, x1: mirror(o.x1, bounds.x, bounds.w), x2: mirror(o.x2, bounds.x, bounds.w) }
              : { ...o, y1: mirror(o.y1, bounds.y, bounds.h), y2: mirror(o.y2, bounds.y, bounds.h) };
          }
          if (o.kind === "wall") return o;

          /* Mirror the box, then mirror what sits inside it: a corner separe
             swaps elbow, a fan swaps its sweep. */
          const nx = axis === "x" ? mirror(b.x + b.w, bounds.x, bounds.w) : b.x;
          const ny = axis === "y" ? mirror(b.y + b.h, bounds.y, bounds.h) : b.y;
          const moved = { dx: nx - b.x, dy: ny - b.y };

          let next = o;
          if (o.kind === "seat" && o.corner) {
            const swapX: Record<string, "tl" | "tr" | "bl" | "br"> = { tl: "tr", tr: "tl", bl: "br", br: "bl" };
            const swapY: Record<string, "tl" | "tr" | "bl" | "br"> = { tl: "bl", bl: "tl", tr: "br", br: "tr" };
            next = { ...o, corner: axis === "x" ? swapX[o.corner] : swapY[o.corner] };
          }
          if (next.kind === "fan") {
            const r = next.rotation;
            next = { ...next, rotation: (((axis === "x" ? 360 - r : 180 - r) % 360) + 360) % 360 };
          }
          return moveObject(next, moved.dx, moved.dy);
        });

        return { ...d, objects, nodes };
      });
    },
    [commit, sel, selSet],
  );

  const group = useCallback(() => {
    if (sel.length < 2) return;
    commit();
    const gid = newUid();
    setDoc((d) => ({
      ...d,
      objects: d.objects.map((o) => (selSet.has(o.uid) ? { ...o, groupId: gid } : o)),
    }));
  }, [commit, sel, selSet]);

  const ungroup = useCallback(() => {
    if (sel.length === 0) return;
    commit();
    setDoc((d) => ({
      ...d,
      objects: d.objects.map((o) =>
        selSet.has(o.uid) ? { ...o, groupId: undefined } : o,
      ),
    }));
  }, [commit, sel, selSet]);

  /* Take one object's look — everything but where it is — and give it to the
     rest of the selection. */
  const [style, setStyle] = useState<Record<string, unknown> | null>(null);

  const copyStyle = useCallback(() => {
    if (!single) return;
    const o = single as Record<string, unknown>;
    const keep = [
      "w", "h", "rotation", "steps", "arc", "direction", "width", "head",
      "depth", "corner", "fontSize", "tracking", "opacity", "align", "size",
      "flipX", "flipY",
    ];
    const picked: Record<string, unknown> = { kind: single.kind };
    for (const k of keep) if (o[k] !== undefined) picked[k] = o[k];
    setStyle(picked);
  }, [single]);

  const pasteStyle = useCallback(() => {
    if (!style || sel.length === 0) return;
    commit();
    const { kind, ...rest } = style;
    setDoc((d) => ({
      ...d,
      objects: d.objects.map((o) =>
        selSet.has(o.uid) && !o.locked && o.kind === kind
          ? ({ ...o, ...rest } as EditorObject)
          : o,
      ),
    }));
  }, [commit, sel, selSet, style]);

  const reorder = useCallback(
    (where: "front" | "forward" | "backward" | "back") => {
      if (sel.length === 0) return;
      commit();
      setDoc((d) => {
        const chosen = d.objects.filter((o) => selSet.has(o.uid));
        const rest = d.objects.filter((o) => !selSet.has(o.uid));
        if (where === "front") return { ...d, objects: [...rest, ...chosen] };
        if (where === "back") return { ...d, objects: [...chosen, ...rest] };

        const objects = [...d.objects];
        const step = where === "forward" ? 1 : -1;
        const order = where === "forward"
          ? [...objects.keys()].reverse()
          : [...objects.keys()];
        for (const i of order) {
          if (!selSet.has(objects[i].uid)) continue;
          const j = i + step;
          if (j < 0 || j >= objects.length || selSet.has(objects[j].uid)) continue;
          [objects[i], objects[j]] = [objects[j], objects[i]];
        }
        return { ...d, objects };
      });
    },
    [commit, sel, selSet],
  );

  const setLocked = useCallback(
    (locked: boolean) => {
      commit();
      setDoc((d) => ({
        ...d,
        objects: d.objects.map((o) => (selSet.has(o.uid) ? { ...o, locked } : o)),
      }));
    },
    [commit, selSet],
  );

  const setGroupFlag = useCallback(
    (key: GroupKey, flag: "locked" | "hidden", value: boolean) => {
      commit();
      setDoc((d) => ({
        ...d,
        objects: d.objects.map((o) => (groupOf(o) === key ? { ...o, [flag]: value } : o)),
      }));
    },
    [commit],
  );

  const selectSame = useCallback(
    (by: "type" | "zone") => {
      if (!single || single.kind !== "seat") return;
      const match = doc.objects.filter(
        (o) =>
          o.kind === "seat" &&
          !o.hidden &&
          (by === "type"
            ? o.type === single.type && Boolean(o.corner) === Boolean(single.corner)
            : o.zone === single.zone),
      );
      setSel(match.map((o) => o.uid));
    },
    [doc, single],
  );

  /* The one thing that rewrites what tables are called, and it is a button.
     Never on load, never on save, never while geometry is being dragged: a
     number that moved on its own would be worthless to the club. */
  const renumber = useCallback(
    (scope: RenumberScope) => {
      commit();
      setDoc((d) => renumberSeats(d, scope, rowBand));
      setRenumberOpen(false);
    },
    [commit, rowBand],
  );

  const setZone = useCallback(
    (zone: ZoneId) => {
      commit();
      setDoc((d) => ({
        ...d,
        objects: d.objects.map((o) =>
          selSet.has(o.uid) && !o.locked && o.kind === "seat" ? { ...o, zone } : o,
        ),
      }));
    },
    [commit, selSet],
  );

  const addRefGuide = useCallback(
    (axis: "x" | "y") => {
      commit();
      const at = axis === "x"
        ? (PLAN.width / 2 - view.x) / view.scale
        : (PLAN.height / 2 - view.y) / view.scale;
      setDoc((d) => ({
        ...d,
        guides: [...d.guides, { id: newUid(), axis, at: Math.round(at) }],
      }));
    },
    [commit, view],
  );

  /* ── the wall chain ───────────────────────────────────────────────────── */

  const finishChain = useCallback(() => {
    setChain([]);
    setGhost(null);
    setDoc((d) => pruneNodes(d));
  }, []);

  const cancelChain = useCallback(() => {
    if (chain.length === 0) { setTool("select"); return; }
    /* The chain's own wall, and the nodes nobody else claimed, go with it. */
    setDoc((d) => pruneNodes({ ...d, objects: d.objects.filter((o) => !(o.kind === "wall" && o.nodes === chain)) }));
    undo();
    setChain([]);
    setGhost(null);
    setTool("select");
  }, [chain, undo]);

  /* ── keyboard ─────────────────────────────────────────────────────────── */

  useEffect(() => {
    const typing = (el: EventTarget | null) =>
      el instanceof HTMLElement && /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName);

    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" && !typing(e.target)) { setSpaceDown(true); e.preventDefault(); }
      if (typing(e.target)) return;
      const mod = e.ctrlKey || e.metaKey;

      if (mod && e.key.toLowerCase() === "z") { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
      if (mod && e.key.toLowerCase() === "y") { e.preventDefault(); redo(); return; }
      if (mod && e.key.toLowerCase() === "d") { e.preventDefault(); duplicateSelection(); return; }
      if (mod && e.key.toLowerCase() === "c") { setClipboard(selected.map((o) => ({ ...o }))); return; }
      if (mod && e.key.toLowerCase() === "v") {
        e.preventDefault();
        if (clipboard.length === 0) return;
        commit();
        const { doc: next, made } = copyInto(doc, clipboard, 20, 20);
        setDoc(next);
        setSel(made);
        return;
      }
      if (mod && e.key.toLowerCase() === "a") {
        e.preventDefault();
        setSel(doc.objects.filter((o) => !o.hidden && !o.locked).map((o) => o.uid));
        return;
      }
      if (mod && e.key.toLowerCase() === "g") {
        e.preventDefault();
        if (e.shiftKey) ungroup(); else group();
        return;
      }

      if (e.key === "Enter" && chain.length > 0) { e.preventDefault(); finishChain(); setTool("select"); return; }
      if (e.key === "Escape") {
        if (chain.length > 0) cancelChain();
        else { setSel([]); setTool("select"); }
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); deleteSelection(); return; }

      const step = e.shiftKey ? 10 : 1;
      const moves: Record<string, [number, number]> = {
        ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step],
      };
      const m = moves[e.key];
      if (m) { e.preventDefault(); nudge(m[0], m[1]); }
    };

    const onUp = (e: KeyboardEvent) => { if (e.code === "Space") setSpaceDown(false); };

    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onUp);
    };
  }, [cancelChain, chain, clipboard, commit, deleteSelection, doc, duplicateSelection, finishChain, nudge, redo, selected, undo]);

  /* ── dragging ─────────────────────────────────────────────────────────── */

  useEffect(() => {
    if (!drag) return;

    const onMove = (e: PointerEvent) => {
      const p = toPlan(e.clientX, e.clientY);

      if (drag.mode === "pan") {
        const ctm = svgRef.current?.getScreenCTM();
        if (!ctm) return;
        const inv = ctm.inverse();
        const now = new DOMPoint(e.clientX, e.clientY).matrixTransform(inv);
        const from = new DOMPoint(drag.fromClient.x, drag.fromClient.y).matrixTransform(inv);
        setView((v) => ({ ...v, x: drag.view.x + (now.x - from.x), y: drag.view.y + (now.y - from.y) }));
        return;
      }

      if (drag.mode === "refguide") {
        setDoc((d) => ({
          ...d,
          guides: d.guides.map((g) => (g.id === drag.id ? { ...g, at: g.axis === "x" ? p.x : p.y } : g)),
        }));
        return;
      }

      if (drag.mode === "marquee") {
        const from = toPlan(drag.fromClient.x, drag.fromClient.y);
        const box = {
          x: Math.min(from.x, p.x), y: Math.min(from.y, p.y),
          w: Math.abs(p.x - from.x), h: Math.abs(p.y - from.y),
        };
        setMarquee(box);
        const hit = doc.objects.filter((o) => {
          if (o.hidden || o.locked) return false;
          const b = bboxOf(o, doc.nodes);
          return b.x < box.x + box.w && box.x < b.x + b.w && b.y < box.y + box.h && box.y < b.y + b.h;
        });
        setSel(drag.additive ? [...new Set([...sel, ...hit.map((o) => o.uid)])] : hit.map((o) => o.uid));
        return;
      }

      const snap = drag.snapshot;

      if (drag.mode === "node") {
        const others = new Set([drag.nodeId]);
        const near = nearestNode(snap, p, 11 / view.scale, others);
        setNodeHint(near);

        /* Straighten against whichever corners this one is wired to. */
        const linked: XY[] = [];
        for (const o of snap.objects) {
          if (o.kind !== "wall") continue;
          o.nodes.forEach((id, i) => {
            if (id !== drag.nodeId) return;
            const n = o.nodes.length;
            const before = o.nodes[(i - 1 + n) % n];
            const after = o.nodes[(i + 1) % n];
            for (const q of [before, after]) {
              if (q && q !== drag.nodeId && snap.nodes[q]) linked.push(snap.nodes[q]);
            }
          });
        }

        let target = p;
        let label: string | null = null;
        if (near) {
          target = snap.nodes[near];
          label = "JOIN";
        } else {
          for (const anchor of linked) {
            const lock = lockToAngle(anchor, p, e.shiftKey, 5);
            if (lock.label) { target = lock.point; label = lock.label; break; }
          }
        }
        setAngleHint(label ? { x: target.x, y: target.y, text: label, snapped: true } : null);
        setDoc((d) => ({ ...d, nodes: { ...d.nodes, [drag.nodeId]: { x: target.x, y: target.y } } }));
        return;
      }

      if (drag.mode === "end") {
        const a = snap.objects.find((o) => o.uid === drag.uid);
        if (!a || a.kind !== "arrow") return;
        /* Shift keeps an arrow on an axis or a true diagonal, which is what an
           architectural arrow nearly always wants to be. */
        const anchor = drag.which === 1 ? { x: a.x2, y: a.y2 } : { x: a.x1, y: a.y1 };
        const target = e.shiftKey ? lockToAngle(anchor, p, true).point : p;
        patch(drag.uid, drag.which === 1
          ? { x1: target.x, y1: target.y }
          : { x2: target.x, y2: target.y });
        return;
      }

      if (drag.mode === "curve") {
        setDoc((d) => ({
          ...d,
          objects: d.objects.map((o) =>
            o.uid === drag.uid && o.kind === "wall"
              ? { ...o, curves: o.curves.map((c, i) => (i === drag.segment ? { x: p.x, y: p.y } : c)) }
              : o,
          ),
        }));
        return;
      }

      if (drag.mode === "move") {
        const from = toPlan(drag.fromClient.x, drag.fromClient.y);
        let dx = p.x - from.x;
        let dy = p.y - from.y;

        if (e.shiftKey) { if (Math.abs(dx) >= Math.abs(dy)) dy = 0; else dx = 0; }

        const movers = snap.objects.filter((o) => drag.uids.includes(o.uid));
        const bounds = unionBox(movers.map((o) => bboxOf(o, snap.nodes)));
        let g: Guide[] = [];

        if (bounds) {
          const shifted = { ...bounds, x: bounds.x + dx, y: bounds.y + dy };
          const others = doc.objects
            .filter((o) => !drag.uids.includes(o.uid) && !o.hidden)
            .map((o) => bboxOf(o, doc.nodes));
          const rails = doc.guides.map((r) => ({ axis: r.axis, at: r.at }));
          const fix = snapToGuides(shifted, others, rails, 5 / view.scale);
          if (!e.shiftKey || dx !== 0) dx += fix.dx;
          if (!e.shiftKey || dy !== 0) dy += fix.dy;
          g = fix.guides;
        }

        /* A separe dropped against a wall may take that wall's bearing. */
        if (snapWalls && !e.altKey && movers.length === 1 && movers[0].kind === "seat" && movers[0].type === "booth") {
          const seat = movers[0];
          const hit = nearestWallAngle(doc, doc.nodes, { x: seat.x + dx, y: seat.y + dy }, 26 / view.scale);
          if (hit) {
            const current = ((seat.rotation % 180) + 180) % 180;
            if (Math.abs(current - hit.angle) > 1.5) patch(seat.uid, { rotation: Math.round(hit.angle) });
          }
        }

        moveDelta.current = { x: dx, y: dy };
        setGuides(g);
        setDeltaHint(bounds ? { x: bounds.x + bounds.w / 2 + dx, y: bounds.y + dy, dx, dy } : null);
        setDoc(translateObjects(snap, drag.uids, dx, dy));
        return;
      }

      if (drag.mode === "rotate") {
        const s = snap.objects.find((o) => o.uid === drag.uid);
        if (!s || s.kind !== "seat") return;
        const raw = (Math.atan2(p.y - s.y, p.x - s.x) * 180) / Math.PI + 90;
        const { angle, snapped } = snapAngle(raw, e.shiftKey);
        setAngleHint({ x: s.x, y: s.y, text: `${angle}°`, snapped });
        patch(drag.uid, { rotation: angle });
        return;
      }

      if (drag.mode === "resize") {
        const o0 = snap.objects.find((o) => o.uid === drag.uid);
        if (!o0) return;
        const { hx, hy } = drag;
        const box = (cx: number, cy: number, w: number, h: number, rot: number) => {
          const th = (rot * Math.PI) / 180;
          const cos = Math.cos(th), sin = Math.sin(th);
          const ax = -hx * (w / 2), ay = -hy * (h / 2);
          const awx = cx + ax * cos - ay * sin;
          const awy = cy + ax * sin + ay * cos;
          const rx = p.x - awx, ry = p.y - awy;
          const lx = rx * cos + ry * sin;
          const ly = -rx * sin + ry * cos;
          let nw = hx !== 0 ? Math.max(6, Math.abs(lx)) : w;
          let nh = hy !== 0 ? Math.max(6, Math.abs(ly)) : h;

          /* Shift keeps the proportion; a round bar table keeps it always,
             because an oval bar table is not a thing the club owns. */
          const round = o0.kind === "seat" && o0.type === "bar" && !o0.corner;
          if ((e.shiftKey || round) && w > 0 && h > 0) {
            if (hx !== 0 && hy !== 0) {
              const k = Math.max(nw / w, nh / h);
              nw = w * k;
              nh = h * k;
            } else if (hx !== 0) {
              nh = h * (nw / w);
            } else if (hy !== 0) {
              nw = w * (nh / h);
            }
          }

          const ox = hx * (nw / 2), oy = hy * (nh / 2);
          return { x: awx + ox * cos - oy * sin, y: awy + ox * sin + oy * cos, w: nw, h: nh };
        };

        if (o0.kind === "seat") {
          const b = box(o0.x, o0.y, o0.w, o0.h, o0.rotation);
          patch(drag.uid, { x: b.x, y: b.y, w: b.w, h: b.h });
        } else if (o0.kind === "structure" || o0.kind === "passage") {
          const b = box(o0.x + o0.w / 2, o0.y + o0.h / 2, o0.w, o0.h, 0);
          patch(drag.uid, { x: b.x - b.w / 2, y: b.y - b.h / 2, w: b.w, h: b.h });
        } else if (o0.kind === "stairs" || o0.kind === "fan") {
          /* Both flights resize freely in both directions — the treads and the
             sweep are worked out from whatever box they end up in, and shift
             is the only thing that holds the proportion. A straight flight
             turns about its own centre, so it is measured in its own frame; a
             fan's angle turns the sweep inside a box that stays square to the
             page, so that one is measured in the page's. */
          const turn = o0.kind === "stairs" ? o0.rotation : 0;
          const b = box(o0.x + o0.w / 2, o0.y + o0.h / 2, o0.w, o0.h, turn);
          patch(drag.uid, { x: b.x - b.w / 2, y: b.y - b.h / 2, w: b.w, h: b.h });
        } else if (o0.kind === "zonemark") {
          /* A numeral has no width and height of its own — it has a size. Any
             handle scales the type, and the figure keeps its new centre. */
          const b0 = bboxOf(o0, snap.nodes);
          const b = box(o0.x, o0.y, b0.w, b0.h, 0);
          const k = Math.max(b.w / b0.w, b.h / b0.h);
          patch(drag.uid, {
            x: b.x,
            y: b.y,
            fontSize: Math.max(20, Math.min(900, o0.fontSize * k)),
          });
        } else if (o0.kind === "spiral") {
          patch(drag.uid, { r: Math.max(6, Math.hypot(p.x - o0.cx, p.y - o0.cy)) });
        }
      }
    };

    const stop = () => {
      /* A corner released on another corner becomes that corner. */
      if (drag.mode === "node" && nodeHint) {
        setDoc((d) => pruneNodes(mergeNodes(d, drag.nodeId, nodeHint)));
      }
      if (drag.mode === "move") {
        const repeat = lastStep.current;
        if (repeat && repeat.uids.length === drag.uids.length && repeat.uids.every((u) => drag.uids.includes(u))) {
          lastStep.current = {
            uids: drag.uids,
            dx: repeat.dx + moveDelta.current.x,
            dy: repeat.dy + moveDelta.current.y,
          };
        }
      }
      setDrag(null);
      setGuides([]);
      setMarquee(null);
      setAngleHint(null);
      setDeltaHint(null);
      setNodeHint(null);
      moveDelta.current = { x: 0, y: 0 };
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
  }, [doc, drag, nodeHint, patch, sel, snapWalls, toPlan, view.scale]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const ctm = svg.getScreenCTM();
      if (!ctm) return;
      const at = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
      setView((v) => {
        const scale = Math.min(16, Math.max(0.3, v.scale * Math.exp(-e.deltaY * 0.0016)));
        return { scale, x: at.x - ((at.x - v.x) * scale) / v.scale, y: at.y - ((at.y - v.y) * scale) / v.scale };
      });
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, [mode]);

  /* ── pointer entry points ─────────────────────────────────────────────── */

  const pressObject = (e: React.PointerEvent, o: EditorObject) => {
    if (tool !== "select" || nodeMode) return;
    e.stopPropagation();
    if (o.locked) { setSel([o.uid]); return; }

    /* Touching one member of a group takes the whole group with it. */
    const kin = o.groupId
      ? doc.objects.filter((q) => q.groupId === o.groupId).map((q) => q.uid)
      : [o.uid];

    let uids: string[];
    if (e.shiftKey) {
      uids = selSet.has(o.uid)
        ? sel.filter((u) => !kin.includes(u))
        : [...new Set([...sel, ...kin])];
      setSel(uids);
    } else if (selSet.has(o.uid)) {
      uids = sel;
    } else {
      uids = kin;
      setSel(uids);
    }

    const movers = doc.objects.filter((q) => uids.includes(q.uid) && !q.locked);
    if (movers.length === 0) return;
    const fromClient = { x: e.clientX, y: e.clientY };
    commit();

    if (e.altKey) {
      const { doc: next, made } = copyInto(doc, movers, 0, 0);
      setDoc(next);
      setSel(made);
      lastStep.current = { uids: made, dx: 0, dy: 0 };
      setDrag({ mode: "move", uids: made, fromClient, snapshot: next });
      return;
    }
    setDrag({ mode: "move", uids: movers.map((q) => q.uid), fromClient, snapshot: doc });
  };

  const pressCanvas = (e: React.PointerEvent) => {
    const p = toPlan(e.clientX, e.clientY);

    if (spaceDown || e.button === 1) {
      setDrag({ mode: "pan", fromClient: { x: e.clientX, y: e.clientY }, view: { x: view.x, y: view.y } });
      return;
    }

    if (tool === "bar" || tool === "high" || tool === "booth" || tool === "corner") {
      addSeat(tool, p);
      if (!e.shiftKey) setTool("select");
      return;
    }

    if (
      tool === "label" || tool === "stairs" || tool === "fan" ||
      tool === "arrow" || tool === "zonemark"
    ) {
      addPiece(tool, p);
      if (!e.shiftKey) setTool("select");
      return;
    }

    if (tool === "wall") {
      const target = ghost?.point ?? p;

      if (chain.length === 0) {
        commit();
        const first = newUid();
        const wallUid = newUid();
        const wall: EditorWall = {
          uid: wallUid, kind: "wall", id: nextObjectId(doc, "wall", "wall"),
          zone: 1, nodes: [first], closed: false, curves: [],
        };
        setDoc((d) => ({
          ...d,
          nodes: { ...d.nodes, [first]: { x: Math.round(target.x), y: Math.round(target.y) } },
          objects: [...d.objects, wall],
        }));
        setChain([wallUid]);
        setSel([wallUid]);
        return;
      }

      const wallUid = chain[0];
      const wall = doc.objects.find((o) => o.uid === wallUid);
      if (!wall || wall.kind !== "wall") return;

      /* Back to where the chain began closes the room outright. */
      if (ghost?.close && wall.nodes.length >= 3) {
        setDoc((d) => ({
          ...d,
          objects: d.objects.map((o) =>
            o.uid === wallUid && o.kind === "wall"
              ? { ...o, closed: true, curves: [...o.curves, null] }
              : o,
          ),
        }));
        finishChain();
        if (!e.shiftKey) setTool("select");
        return;
      }

      const joinTo = nearestNode(doc, target, px(11), new Set(wall.nodes.slice(-1)));
      const id = joinTo ?? newUid();
      setDoc((d) => ({
        ...d,
        nodes: joinTo ? d.nodes : { ...d.nodes, [id]: { x: Math.round(target.x), y: Math.round(target.y) } },
        objects: d.objects.map((o) =>
          o.uid === wallUid && o.kind === "wall"
            ? { ...o, nodes: [...o.nodes, id], curves: [...o.curves, null] }
            : o,
        ),
      }));
      return;
    }

    if (!e.shiftKey) setSel([]);
    setDrag({ mode: "marquee", fromClient: { x: e.clientX, y: e.clientY }, additive: e.shiftKey });
  };

  /* Where the next wall corner would land, updated as the pointer moves. */
  const hoverCanvas = (e: React.PointerEvent) => {
    if (tool !== "wall" || chain.length === 0) { if (ghost) setGhost(null); return; }
    const wall = doc.objects.find((o) => o.uid === chain[0]);
    if (!wall || wall.kind !== "wall") return;
    const pts = wallPoints(wall, doc.nodes);
    const last = pts[pts.length - 1];
    const first = pts[0];
    if (!last) return;

    const p = toPlan(e.clientX, e.clientY);
    const lock = lockToAngle(last, p, e.shiftKey);
    const close = Boolean(first && pts.length >= 3 && Math.hypot(p.x - first.x, p.y - first.y) < px(14));
    setGhost({
      point: close && first ? first : lock.point,
      label: close ? "CLOSE SHAPE" : lock.label,
      close,
    });
  };

  const startResize = (e: React.PointerEvent, uid: string, hx: number, hy: number) => {
    e.stopPropagation(); commit(); setDrag({ mode: "resize", uid, hx, hy, snapshot: doc });
  };
  const startRotate = (e: React.PointerEvent, uid: string) => {
    e.stopPropagation(); commit(); setDrag({ mode: "rotate", uid, snapshot: doc });
  };
  const startNode = (e: React.PointerEvent, nodeId: string) => {
    e.stopPropagation(); commit(); setDrag({ mode: "node", nodeId, snapshot: doc });
  };
  const startCurve = (e: React.PointerEvent, uid: string, segment: number) => {
    e.stopPropagation(); commit(); setDrag({ mode: "curve", uid, segment, snapshot: doc });
  };
  const startEnd = (e: React.PointerEvent, uid: string, which: 1 | 2) => {
    e.stopPropagation(); commit(); setDrag({ mode: "end", uid, which, snapshot: doc });
  };
  const startRefGuide = (e: React.PointerEvent, id: string) => {
    e.stopPropagation(); commit(); setDrag({ mode: "refguide", id });
  };

  const copyData = async () => {
    try {
      await navigator.clipboard.writeText(serializeDoc(doc));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setDataOpen(true);
    }
  };

  /* ── preview ──────────────────────────────────────────────────────────── */

  const taken = reservedSeats("vodka-experience");
  const previewSeats: Seat[] = seatsOf(doc).map((s) => ({
    id: s.id, display: numberOf(s), type: s.type, zone: s.zone, x: s.x, y: s.y, w: s.w, h: s.h,
    rotation: s.rotation, corner: s.corner, depth: s.depth,
    capacity: SEAT_KINDS[s.type].capacity,
    status: taken.has(s.id) ? "reserved" : "available",
  }));
  const previewArchitecture = useMemo(() => docToArchitecture(doc), [doc]);

  /* ── drawing ──────────────────────────────────────────────────────────── */

  const hs = px(7);
  const stroke = px(1.5);
  const selectionBox = unionBox(selected.map((o) => bboxOf(o, doc.nodes)));

  const handleTurn =
    single?.kind === "seat" && single.rotation
      ? `rotate(${single.rotation} ${single.x} ${single.y})`
      : single?.kind === "stairs" && single.rotation
        ? `rotate(${single.rotation} ${single.x + single.w / 2} ${single.y + single.h / 2})`
        : undefined;

  const shows = (o: EditorObject) => {
    if (o.hidden) return false;
    if (o.kind === "seat") return o.type === "bar" ? visible.bar : o.type === "high" ? visible.high : visible.booth;
    if (o.kind === "wall") return visible.walls;
    if (o.kind === "label") return visible.labels;
    if (o.kind === "zonemark") return visible.zoneMarks;
    return visible.structures;
  };

  const pairDistance = useMemo(() => {
    if (selected.length !== 2) return null;
    const a = bboxOf(selected[0], doc.nodes);
    const b = bboxOf(selected[1], doc.nodes);
    return Math.hypot(a.x + a.w / 2 - (b.x + b.w / 2), a.y + a.h / 2 - (b.y + b.h / 2));
  }, [doc.nodes, selected]);

  const sharedNodeCount =
    single?.kind === "wall"
      ? single.nodes.filter((id) => nodeDegree(doc, id) > 1).length
      : 0;

  const numbering = numberingCounts(doc);
  const manualCount = numbering.bar.manual + numbering.high.manual + numbering.booth.manual;

  const counts = {
    bar: seatsOf(doc).filter((s) => s.type === "bar").length,
    high: seatsOf(doc).filter((s) => s.type === "high").length,
    booth: seatsOf(doc).filter((s) => s.type === "booth").length,
  };

  const toolBtn = (t: Tool, label: string, colour?: string) => (
    <button
      key={t}
      type="button"
      onClick={() => { if (chain.length) finishChain(); setTool(t); }}
      className={`border px-2 py-1.5 text-[0.5625rem] uppercase tracking-[0.1em] ${
        tool === t ? "bg-amber-500 text-neutral-950" : "hover:bg-neutral-800"
      }`}
      style={tool === t ? undefined : { borderColor: colour ?? "#404040", color: colour ?? "#d4d4d4" }}
    >
      {label}
    </button>
  );

  const toggle = (on: boolean, label: string, onClick: () => void) => (
    <button
      key={label}
      type="button"
      onClick={onClick}
      className={`border px-1.5 py-1 text-[0.5625rem] uppercase tracking-[0.08em] ${
        on ? "border-neutral-600 text-neutral-200" : "border-neutral-800 text-neutral-600"
      }`}
    >
      {label}
    </button>
  );

  return (
    <main className="flex h-[100svh] w-full flex-col bg-neutral-950 text-neutral-200">
      {askRestore && draft ? (
        <RestorePrompt
          draft={draft}
          onContinue={() => adopt(draft.floorPlan, draft.savedAt)}
          onLoadCode={() => {
            /* Only ever reached through the confirmation inside the prompt. */
            clearDraft();
            setDraftHandled(true);
            setSavedAt(null);
          }}
        />
      ) : null}

      {importError ? (
        <ImportError message={importError} onDismiss={() => setImportError(null)} />
      ) : null}

      <header className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-neutral-800 px-3 py-2">
        <span className="text-[0.5625rem] uppercase tracking-[0.24em] text-amber-400">Floor plan editor</span>

        <div className="flex overflow-hidden border border-neutral-700">
          {(["edit", "preview"] as const).map((m) => (
            <button
              key={m} type="button" onClick={() => setMode(m)}
              className={`px-2 py-1.5 text-[0.5625rem] uppercase tracking-[0.1em] ${
                mode === m ? "bg-amber-500 text-neutral-950" : "text-neutral-400 hover:text-neutral-100"
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        {mode === "edit" ? (
          <>
            <div className="flex gap-1">
              {toolBtn("select", "Select")}
              {toolBtn("wall", "+ Wall", WALL_INK)}
              {toolBtn("label", "+ Natpis", "#a78bfa")}
              {toolBtn("bar", "+ Barski", TYPE_INK.bar)}
              {toolBtn("high", "+ Visoki", TYPE_INK.high)}
              {toolBtn("booth", "+ Separe", TYPE_INK.booth)}
            </div>

            {/* the less-reached-for pieces, folded away so the bar stays usable */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setAddOpen((v) => !v)}
                className={`border px-2 py-1.5 text-[0.5625rem] uppercase tracking-[0.1em] ${
                  ["corner", "stairs", "fan", "arrow", "zonemark"].includes(tool)
                    ? "bg-amber-500 text-neutral-950"
                    : "border-neutral-700 text-neutral-300"
                }`}
              >
                Add ▾
              </button>
              {addOpen ? (
                <div className="absolute left-0 top-full z-30 mt-1 w-52 border border-neutral-700 bg-neutral-950 p-1.5">
                  {(
                    [
                      ["corner", "Corner separe", TYPE_INK.booth],
                      ["stairs", "Stepenice", "#f97316"],
                      ["fan", "Polukružne stepenice", "#f97316"],
                      ["arrow", "Strelica", "#38bdf8"],
                      ["zonemark", "Broj zone", "#c4b5fd"],
                    ] as const
                  ).map(([t, label, colour]) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => { setTool(t); setAddOpen(false); }}
                      className="block w-full px-2 py-1.5 text-left text-[0.6875rem] text-neutral-300 hover:bg-neutral-800"
                      style={{ color: tool === t ? "#fbbf24" : colour }}
                    >
                      + {label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            {/* Which level a click on a wall lands at. Always visible, so it is
                never a mystery why a click selected a whole hall. */}
            <div className="flex overflow-hidden border border-neutral-700">
              {(["chain", "segment", "node"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => { setWallMode(m); setSegment(null); }}
                  title={
                    m === "chain" ? "Select the whole wall run"
                      : m === "segment" ? "Select one segment between two corners"
                        : "Drag the shared corners"
                  }
                  className={`px-2 py-1.5 text-[0.5625rem] uppercase tracking-[0.1em] ${
                    wallMode === m ? "bg-emerald-500 text-neutral-950" : "text-neutral-400 hover:text-neutral-100"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>

            <div className="flex gap-1">
              <button type="button" onClick={undo} disabled={past.length === 0}
                className="border border-neutral-700 px-2 py-1.5 text-[0.5625rem] uppercase text-neutral-300 disabled:opacity-30">↶</button>
              <button type="button" onClick={redo} disabled={future.length === 0}
                className="border border-neutral-700 px-2 py-1.5 text-[0.5625rem] uppercase text-neutral-300 disabled:opacity-30">↷</button>
            </div>

            <div className="flex gap-1">
              <Btn onClick={() => flip("x")} title="Flip horizontally" disabled={sel.length === 0}>⇋</Btn>
              <Btn onClick={() => flip("y")} title="Flip vertically" disabled={sel.length === 0}>⇵</Btn>
              <Btn onClick={copyStyle} title="Copy this object's look" disabled={!single}>Copy style</Btn>
              <Btn
                onClick={pasteStyle}
                title={style ? `Apply the copied ${String(style.kind)} settings` : "Nothing copied"}
                tone={style ? "on" : "plain"}
                disabled={!style || sel.length === 0}
              >
                Paste style
              </Btn>
            </div>

            {/* Numbering is a deliberate act, so it lives behind a button and
                states what it is about to do before it does it. */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setRenumberOpen((v) => !v)}
                className={`border px-2 py-1.5 text-[0.5625rem] uppercase tracking-[0.1em] ${
                  renumberOpen ? "bg-amber-500 text-neutral-950" : "border-neutral-700 text-neutral-300"
                }`}
              >
                Renumber tables ▾
              </button>
              {renumberOpen ? (
                <div className="absolute left-0 top-full z-30 mt-1 w-72 space-y-2.5 border border-neutral-700 bg-neutral-950 p-2.5">
                  <p className="text-[0.625rem] leading-relaxed text-neutral-400">
                    Numbers run zone 1 → 2 → 3 → galerija, top to bottom and
                    left to right within each row. B, V and S each count on
                    their own. Nothing is renumbered until you press one of
                    these.
                  </p>
                  <label className="flex items-center justify-between gap-2">
                    <span className="text-[0.5625rem] uppercase tracking-[0.14em] text-neutral-500">
                      Row band
                    </span>
                    <input
                      type="number"
                      value={rowBand}
                      onChange={(e) => setRowBand(Math.max(1, Number(e.target.value) || 1))}
                      className="w-16 border border-neutral-700 bg-neutral-900 px-1.5 py-1 text-right text-[0.75rem] tabular-nums text-neutral-100 outline-none focus:border-amber-500/70"
                    />
                  </label>
                  <p className="text-[0.5625rem] leading-relaxed text-neutral-600">
                    How far apart two tables may sit vertically and still count
                    as one row — the drawing&rsquo;s rows lean.
                  </p>
                  <div className="grid grid-cols-2 gap-1">
                    <Btn onClick={() => renumber("all")}>All</Btn>
                    <Btn onClick={() => renumber("bar")}>
                      Barski · {numbering.bar.auto}
                    </Btn>
                    <Btn onClick={() => renumber("high")}>
                      Visoki · {numbering.high.auto}
                    </Btn>
                    <Btn onClick={() => renumber("booth")}>
                      Separe · {numbering.booth.auto}
                    </Btn>
                  </div>
                  {manualCount > 0 ? (
                    <p className="text-[0.5625rem] uppercase tracking-[0.12em] text-amber-400/80">
                      {manualCount} held by hand · stepped over
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="flex items-center gap-1">
              {toggle(showReference, "Ref", () => setShowReference((v) => !v))}
              {toggle(visible.bar, "Barski", () => setVisible((v) => ({ ...v, bar: !v.bar })))}
              {toggle(visible.high, "Visoki", () => setVisible((v) => ({ ...v, high: !v.high })))}
              {toggle(visible.booth, "Separe", () => setVisible((v) => ({ ...v, booth: !v.booth })))}
              {toggle(visible.walls, "Walls", () => setVisible((v) => ({ ...v, walls: !v.walls })))}
              {toggle(visible.structures, "Struct", () => setVisible((v) => ({ ...v, structures: !v.structures })))}
              {toggle(visible.labels, "Labels", () => setVisible((v) => ({ ...v, labels: !v.labels })))}
              {toggle(visible.zoneMarks, "Zone №", () => setVisible((v) => ({ ...v, zoneMarks: !v.zoneMarks })))}
              {toggle(showNumbers, "Numbers", () => setShowNumbers((v) => !v))}
              {toggle(snapWalls, "Wall snap", () => setSnapWalls((v) => !v))}
            </div>

            <label className="flex items-center gap-1.5 text-[0.5625rem] uppercase tracking-[0.1em] text-neutral-500">
              <input type="range" min={0} max={1} step={0.01} value={opacity}
                onChange={(e) => setOpacity(Number(e.target.value))} className="w-20" />
              <span className="w-7 tabular-nums text-neutral-300">{Math.round(opacity * 100)}%</span>
            </label>

            <div className="flex gap-1">
              <Btn onClick={() => addRefGuide("y")}>+ H guide</Btn>
              <Btn onClick={() => addRefGuide("x")}>+ V guide</Btn>
              <Btn onClick={() => setView({ scale: 1, x: 0, y: 0 })}>Fit</Btn>
            </div>
          </>
        ) : null}

        <div className="ml-auto flex items-center gap-1.5">
          <PersistenceBar
            /* "Saving…" is what a pending write looks like, so it is derived
               from there being one rather than stored and kept in step. */
            saveState={dirty && !askRestore ? "saving" : saveState}
            savedAt={savedAt}
            dirty={dirty}
            snapshots={snapshots}
            doc={doc}
            onSaveDraft={() => {
              const at = writeDraft(doc);
              if (at) { setSavedAt(at); setDirty(false); setSaveState("saved"); }
              else setSaveState("failed");
            }}
            onSnapshot={(label) => setSnapshots(addSnapshot(doc, label))}
            onRestoreSnapshot={(s) => adopt(s.floorPlan, null)}
            onDeleteSnapshot={(id) => setSnapshots(removeSnapshot(id))}
            onDownload={() => downloadBackup(doc)}
            onImport={async (file) => {
              try {
                const env = await readBackupFile(file);
                adopt(env.floorPlan, null);
                setImportError(null);
              } catch (e) {
                setImportError(e instanceof Error ? e.message : "That file could not be read.");
              }
            }}
            onClearDraft={() => { clearDraft(); setSavedAt(null); setSaveState("idle"); }}
          />
          <Btn onClick={() => setDataOpen((v) => !v)}>{dataOpen ? "Hide data" : "Show data"}</Btn>
          <button type="button" onClick={copyData}
            className="border border-amber-500 bg-amber-500 px-2.5 py-1.5 text-[0.5625rem] uppercase tracking-[0.1em] text-neutral-950 hover:bg-amber-400">
            {copied ? "Copied ✓" : "Copy floor plan data"}
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <div className="relative min-w-0 flex-1">
          {mode === "preview" ? (
            <FloorPlan
              seats={previewSeats}
              onSelect={() => {}}
              onHoverChange={() => {}}
              architecture={previewArchitecture}
            />
          ) : (
            <svg
              ref={svgRef}
              viewBox={`0 0 ${PLAN.width} ${PLAN.height}`}
              preserveAspectRatio="xMidYMid meet"
              className="h-full w-full bg-neutral-900"
              style={{ touchAction: "none", cursor: spaceDown ? "grab" : tool === "select" ? "default" : "crosshair" }}
              onPointerDown={pressCanvas}
              onPointerMove={hoverCanvas}
              onDoubleClick={() => { if (chain.length) { finishChain(); setTool("select"); } }}
            >
              <g transform={`translate(${view.x} ${view.y}) scale(${view.scale})`}>
                {showReference ? (
                  <image
                    href={REFERENCE_IMAGE}
                    x={refFit.x} y={refFit.y}
                    width={PLAN.width * refFit.scale} height={PLAN.height * refFit.scale}
                    opacity={opacity} preserveAspectRatio="none" pointerEvents="none"
                  />
                ) : null}

                {/* tracing straight-edges */}
                {doc.guides.map((g) => (
                  <line
                    key={g.id}
                    x1={g.axis === "x" ? g.at : -4000} y1={g.axis === "x" ? -4000 : g.at}
                    x2={g.axis === "x" ? g.at : 4000} y2={g.axis === "x" ? 4000 : g.at}
                    stroke="#38bdf8" strokeWidth={stroke} strokeDasharray={`${px(7)} ${px(5)}`}
                    style={{ cursor: g.axis === "x" ? "ew-resize" : "ns-resize" }}
                    onPointerDown={(e) => startRefGuide(e, g.id)}
                  />
                ))}

                {doc.objects.map((o) => {
                  if (!shows(o)) return null;
                  const on = selSet.has(o.uid);
                  const dim = o.locked ? 0.4 : 1;

                  if (o.kind === "wall") {
                    const pts = wallPoints(o, doc.nodes);
                    const segs = segmentCount(o);
                    return (
                      <g key={o.uid} opacity={dim}>
                        <path
                          d={wallPath(o, doc.nodes)}
                          fill="none" stroke={on ? "#fff" : WALL_INK}
                          strokeWidth={px(on ? 3 : 2)}
                          style={{ cursor: wallMode === "chain" ? "move" : "default" }}
                          onPointerDown={(e) => { if (wallMode === "chain") pressObject(e, o); }}
                        />
                        {/* In SEGMENT mode each span between two corners is its
                            own hit target, laid invisibly over the run. */}
                        {wallMode === "segment"
                          ? Array.from({ length: segs }, (_, i) => {
                              const a = pts[i];
                              const b = pts[(i + 1) % pts.length];
                              if (!a || !b) return null;
                              const picked = segment?.uid === o.uid && segment.index === i;
                              return (
                                <line
                                  key={`seg-${i}`}
                                  x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                                  stroke={picked ? "#fbbf24" : "transparent"}
                                  strokeWidth={px(picked ? 5 : 12)}
                                  strokeLinecap="round"
                                  style={{ cursor: "pointer" }}
                                  onPointerDown={(e) => {
                                    e.stopPropagation();
                                    setSel([o.uid]);
                                    setSegment({ uid: o.uid, index: i });
                                  }}
                                />
                              );
                            })
                          : null}
                      </g>
                    );
                  }
                  if (o.kind === "spiral") {
                    /* An ellipse rather than a circle, because a flight that
                       states two radii has two, and the handle you drag has
                       to sit on the shape the map draws. */
                    return (
                      <ellipse
                        key={o.uid} cx={o.cx} cy={o.cy} rx={o.r} ry={o.ry ?? o.r} opacity={dim}
                        fill="rgba(249,115,22,0.08)" stroke={on ? "#fff" : "#f97316"}
                        strokeWidth={px(on ? 3 : 2)} style={{ cursor: "move" }}
                        onPointerDown={(e) => pressObject(e, o)}
                      />
                    );
                  }
                  if (o.kind === "label") {
                    return (
                      <text
                        key={o.uid} x={o.x} y={o.y}
                        opacity={dim * (o.opacity ?? 1)}
                        textAnchor={o.align ?? "middle"}
                        dominantBaseline="central"
                        transform={o.rotation ? `rotate(${o.rotation} ${o.x} ${o.y})` : undefined}
                        fill={on ? "#fff" : "#a78bfa"}
                        style={{
                          fontSize: o.fontSize ?? 15,
                          letterSpacing: `${o.tracking ?? 0.34}em`,
                          cursor: "move",
                        }}
                        onPointerDown={(e) => pressObject(e, o)}
                        /* Quickest way to retype one: double-click it. */
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          const next = window.prompt("Label text", o.text ?? o.id);
                          if (next !== null) { commit(); patch(o.uid, { text: next }); }
                        }}
                      >
                        {o.text ?? o.id}
                      </text>
                    );
                  }
                  if (o.kind === "zonemark") {
                    return (
                      <text
                        key={o.uid} x={o.x} y={o.y}
                        textAnchor="middle" dominantBaseline="central"
                        transform={o.rotation ? `rotate(${o.rotation} ${o.x} ${o.y})` : undefined}
                        opacity={dim}
                        fill={on ? "#fff" : "#c4b5fd"}
                        /* Faint on the map, but never so faint here that it
                           cannot be found and taken hold of. */
                        fillOpacity={on ? 0.85 : Math.max(0.22, o.opacity)}
                        style={{
                          fontFamily: "var(--font-serif)",
                          fontSize: o.fontSize,
                          cursor: "move",
                        }}
                        onPointerDown={(e) => pressObject(e, o)}
                      >
                        {o.zone}
                      </text>
                    );
                  }
                  if (o.kind === "structure" || o.kind === "passage") {
                    const colour = o.kind === "passage" ? "#4ade80" : "#f97316";
                    return (
                      <rect
                        key={o.uid} x={o.x} y={o.y} width={o.w} height={o.h} opacity={dim}
                        fill={o.kind === "passage" ? "rgba(74,222,128,0.18)" : "rgba(249,115,22,0.10)"}
                        stroke={on ? "#fff" : colour} strokeWidth={px(on ? 3 : 2)}
                        style={{ cursor: "move" }} onPointerDown={(e) => pressObject(e, o)}
                      />
                    );
                  }

                  if (o.kind === "stairs") {
                    const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
                    return (
                      <g
                        key={o.uid} opacity={dim}
                        transform={o.rotation ? `rotate(${o.rotation} ${cx} ${cy})` : undefined}
                        style={{ cursor: "move" }} onPointerDown={(e) => pressObject(e, o)}
                      >
                        <rect x={o.x} y={o.y} width={o.w} height={o.h}
                          fill="rgba(249,115,22,0.10)" stroke={on ? "#fff" : "#f97316"}
                          strokeWidth={px(on ? 3 : 2)} />
                        {Array.from({ length: Math.max(1, o.steps - 1) }, (_, i) => {
                          const ty = o.y + ((i + 1) * o.h) / o.steps;
                          return (
                            <line key={i} x1={o.x} y1={ty} x2={o.x + o.w} y2={ty}
                              stroke={on ? "#fff" : "#fb923c"} strokeWidth={px(1)} />
                          );
                        })}
                        <line
                          x1={cx} y1={o.direction === "up" ? o.y + o.h - px(4) : o.y + px(4)}
                          x2={cx} y2={o.direction === "up" ? o.y + px(4) : o.y + o.h - px(4)}
                          stroke="#38bdf8" strokeWidth={px(1.5)} markerEnd="" />
                      </g>
                    );
                  }

                  if (o.kind === "fan") {
                    const a = fanArc(o);
                    const rad = (d: number) => (d * Math.PI) / 180;
                    const at = (d: number) => [a.cx + Math.cos(rad(d)) * a.r, a.cy + Math.sin(rad(d)) * a.r];
                    const [sx, sy] = at(a.from);
                    const [ex, ey] = at(a.to);
                    const large = Math.abs(a.to - a.from) > 180 ? 1 : 0;
                    return (
                      <g key={o.uid} opacity={dim} style={{ cursor: "move" }}
                        onPointerDown={(e) => pressObject(e, o)}>
                        <path
                          d={`M ${a.cx} ${a.cy} L ${sx} ${sy} A ${a.r} ${a.r} 0 ${large} 1 ${ex} ${ey} Z`}
                          fill="rgba(249,115,22,0.10)" stroke={on ? "#fff" : "#f97316"}
                          strokeWidth={px(on ? 3 : 2)} />
                        {Array.from({ length: Math.max(1, o.steps - 1) }, (_, i) => {
                          const [tx, ty] = at(a.from + ((i + 1) * (a.to - a.from)) / o.steps);
                          return (
                            <line key={i} x1={a.cx} y1={a.cy} x2={tx} y2={ty}
                              stroke={on ? "#fff" : "#fb923c"} strokeWidth={px(1)} />
                          );
                        })}
                      </g>
                    );
                  }

                  if (o.kind === "arrow") {
                    const ang = Math.atan2(o.y2 - o.y1, o.x2 - o.x1);
                    const wing = (t: number) => [
                      o.x2 - Math.cos(ang + t) * o.head,
                      o.y2 - Math.sin(ang + t) * o.head,
                    ];
                    const [lx, ly] = wing(0.42);
                    const [rx, ry] = wing(-0.42);
                    return (
                      <g key={o.uid} opacity={dim} style={{ cursor: "move" }}
                        onPointerDown={(e) => pressObject(e, o)}>
                        <line x1={o.x1} y1={o.y1} x2={o.x2} y2={o.y2}
                          stroke={on ? "#fff" : "#38bdf8"} strokeWidth={px(Math.max(o.width, 2))}
                          strokeLinecap="round" />
                        <path d={`M ${lx} ${ly} L ${o.x2} ${o.y2} L ${rx} ${ry}`} fill="none"
                          stroke={on ? "#fff" : "#38bdf8"} strokeWidth={px(Math.max(o.width, 2))}
                          strokeLinecap="round" strokeLinejoin="round" />
                        {on ? (
                          <>
                            <circle cx={o.x1} cy={o.y1} r={hs * 0.7} fill="#fff" stroke="#000"
                              strokeWidth={stroke / 2} style={{ cursor: "move" }}
                              onPointerDown={(e) => startEnd(e, o.uid, 1)} />
                            <circle cx={o.x2} cy={o.y2} r={hs * 0.7} fill="#fff" stroke="#000"
                              strokeWidth={stroke / 2} style={{ cursor: "move" }}
                              onPointerDown={(e) => startEnd(e, o.uid, 2)} />
                          </>
                        ) : null}
                      </g>
                    );
                  }

                  const ink = TYPE_INK[o.type];
                  const turn = o.rotation ? `rotate(${o.rotation} ${o.x} ${o.y})` : undefined;
                  const x0 = o.x - o.w / 2, y0 = o.y - o.h / 2;
                  return (
                    <g key={o.uid} transform={turn} opacity={dim} style={{ cursor: "move" }}
                      onPointerDown={(e) => pressObject(e, o)}>
                      {o.type === "bar" ? (
                        <ellipse cx={o.x} cy={o.y} rx={o.w / 2} ry={o.h / 2}
                          fill={on ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.04)"}
                          stroke={on ? "#fff" : ink} strokeWidth={px(on ? 3 : 2)} />
                      ) : o.corner ? (
                        <path
                          d={cornerOutline(x0, y0, o.w, o.h, o.depth ?? 18, o.corner)}
                          fill={on ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.04)"}
                          stroke={on ? "#fff" : ink} strokeWidth={px(on ? 3 : 2)} strokeLinejoin="round" />
                      ) : (
                        <rect x={x0} y={y0} width={o.w} height={o.h}
                          fill={on ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.04)"}
                          stroke={on ? "#fff" : ink} strokeWidth={px(on ? 3 : 2)} />
                      )}
                      {/* SHOW TABLE NUMBERS. Drawn at a constant size on
                          screen whatever the magnification, and never a
                          pointer target — turning them on cannot get between
                          the cursor and the table underneath. */}
                      {showNumbers ? (
                        <text x={o.x} y={o.y} textAnchor="middle" dominantBaseline="central"
                          fill={on ? "#fff" : ink} style={{ fontSize: px(9) }} pointerEvents="none">
                          {numberOf(o)}
                        </text>
                      ) : null}
                    </g>
                  );
                })}

                {/* wall corners — all of them in node mode, the selected wall's otherwise */}
                {visible.walls
                  ? doc.objects.map((o) => {
                      if (o.kind !== "wall" || o.hidden || o.locked) return null;
                      if (!nodeMode && !selSet.has(o.uid)) return null;
                      const pts = wallPoints(o, doc.nodes);
                      const segments = o.closed ? pts.length : pts.length - 1;
                      return (
                        <g key={`n-${o.uid}`}>
                          {o.nodes.map((id, i) => {
                            const p = doc.nodes[id];
                            if (!p) return null;
                            const joined = nodeDegree(doc, id) > 1;
                            const near = nodeHint === id;
                            return (
                              <circle
                                key={`${id}-${i}`} cx={p.x} cy={p.y}
                                r={near ? hs : joined ? hs * 0.85 : hs * 0.7}
                                fill={near ? "#38bdf8" : joined ? "#fbbf24" : "#fff"}
                                stroke="#000" strokeWidth={stroke / 2}
                                style={{ cursor: "move" }}
                                onPointerDown={(e) => startNode(e, id)}
                              />
                            );
                          })}
                          {nodeMode
                            ? Array.from({ length: Math.max(0, segments) }, (_, i) => {
                                const a = pts[i];
                                const b = pts[(i + 1) % pts.length];
                                if (!a || !b) return null;
                                const c = o.curves[i];
                                const mid = c ?? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
                                return (
                                  <circle
                                    key={`c-${o.uid}-${i}`} cx={mid.x} cy={mid.y} r={hs * 0.55}
                                    fill={c ? "#a78bfa" : "#525252"} stroke="#000" strokeWidth={stroke / 2}
                                    style={{ cursor: "pointer" }}
                                    onPointerDown={(e) => startCurve(e, o.uid, i)}
                                    onDoubleClick={(e) => {
                                      e.stopPropagation();
                                      commit();
                                      patch(o.uid, { curves: o.curves.map((q, j) => (j === i ? null : q)) });
                                    }}
                                  />
                                );
                              })
                            : null}
                        </g>
                      );
                    })
                  : null}

                {guides.map((g, i) =>
                  g.axis === "x" ? (
                    <line key={i} x1={g.at} y1={g.from} x2={g.at} y2={g.to}
                      stroke="#f472d0" strokeWidth={px(1)} strokeDasharray={`${px(5)} ${px(4)}`} />
                  ) : (
                    <line key={i} x1={g.from} y1={g.at} x2={g.to} y2={g.at}
                      stroke="#f472d0" strokeWidth={px(1)} strokeDasharray={`${px(5)} ${px(4)}`} />
                  ),
                )}

                {/* handles on a single unlocked object */}
                {single && !single.locked && single.kind !== "wall" && single.kind !== "label" && !nodeMode ? (
                  /* The handles stand on the object as drawn, which for a
                     straight flight means turned with it — otherwise dragging
                     the corner of a stair set at an angle pulls in a direction
                     nothing on screen points in. A fan's angle turns its sweep
                     rather than its box, so that one keeps square handles. */
                  <g transform={handleTurn}>
                    {HANDLES.map(([hx, hy]) => {
                      const b = bboxOf(single, doc.nodes);
                      const cx = b.x + b.w / 2 + (hx * b.w) / 2;
                      const cy = b.y + b.h / 2 + (hy * b.h) / 2;
                      return (
                        <rect key={`${hx},${hy}`} x={cx - hs / 2} y={cy - hs / 2} width={hs} height={hs}
                          fill="#fff" stroke="#000" strokeWidth={stroke / 2}
                          style={{ cursor: hx === 0 ? "ns-resize" : hy === 0 ? "ew-resize" : "nwse-resize" }}
                          onPointerDown={(e) => startResize(e, single.uid, hx, hy)} />
                      );
                    })}
                    {single.kind === "seat" ? (
                      <>
                        <line x1={single.x} y1={single.y - single.h / 2}
                          x2={single.x} y2={single.y - single.h / 2 - px(24)}
                          stroke="#38bdf8" strokeWidth={stroke} />
                        <circle cx={single.x} cy={single.y - single.h / 2 - px(28)} r={hs * 0.85}
                          fill="#38bdf8" stroke="#000" strokeWidth={stroke / 2}
                          style={{ cursor: "grab" }} onPointerDown={(e) => startRotate(e, single.uid)} />
                      </>
                    ) : null}
                  </g>
                ) : null}

                {selected.length > 1 && selectionBox ? (
                  <rect x={selectionBox.x - 4} y={selectionBox.y - 4}
                    width={selectionBox.w + 8} height={selectionBox.h + 8}
                    fill="none" stroke="#fbbf24" strokeWidth={stroke}
                    strokeDasharray={`${px(6)} ${px(4)}`} pointerEvents="none" />
                ) : null}

                {marquee ? (
                  <rect x={marquee.x} y={marquee.y} width={marquee.w} height={marquee.h}
                    fill="rgba(251,191,36,0.10)" stroke="#fbbf24" strokeWidth={stroke} pointerEvents="none" />
                ) : null}

                {/* the wall being drawn */}
                {ghost && chain.length > 0 ? (
                  <g pointerEvents="none">
                    <circle cx={ghost.point.x} cy={ghost.point.y} r={hs * (ghost.close ? 1.1 : 0.7)}
                      fill={ghost.close ? "#38bdf8" : WALL_INK} />
                    {ghost.label ? (
                      <text x={ghost.point.x + px(14)} y={ghost.point.y - px(12)}
                        fill={ghost.close ? "#7dd3fc" : "#86efac"}
                        style={{ fontSize: px(13), fontWeight: 600 }}>
                        {ghost.label}
                      </text>
                    ) : null}
                  </g>
                ) : null}

                {angleHint ? (
                  <text x={angleHint.x + px(16)} y={angleHint.y - px(16)} pointerEvents="none"
                    fill={angleHint.snapped ? "#7dd3fc" : "#d4d4d4"}
                    style={{ fontSize: px(13), fontWeight: 600 }}>
                    {angleHint.text}
                  </text>
                ) : null}

                {deltaHint && (deltaHint.dx || deltaHint.dy) ? (
                  <text x={deltaHint.x} y={deltaHint.y - px(12)} textAnchor="middle" pointerEvents="none"
                    fill="#fbbf24" style={{ fontSize: px(12) }}>
                    {Math.round(deltaHint.dx)}, {Math.round(deltaHint.dy)}
                  </text>
                ) : null}
              </g>
            </svg>
          )}

          {mode === "edit" ? (
            <p className="pointer-events-none absolute bottom-1.5 left-3 max-w-[94%] text-[0.5rem] uppercase leading-relaxed tracking-[0.14em] text-neutral-600">
              {tool === "wall"
                ? "WALL — click to place corners · shift locks 45° · click the first corner to CLOSE SHAPE · enter or double-click finishes · esc cancels"
                : "drag move · shift axis lock · alt copy-drag · shift+click multi · marquee select · space+drag pan · wheel zoom · ⌘Z/⌘⇧Z · ⌘C/⌘V · ⌘D repeats last offset · del delete"}
            </p>
          ) : null}
        </div>

        {mode === "edit" ? (
          <aside className="flex w-72 shrink-0 flex-col border-l border-neutral-800">
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {/* One span of a wall, with the three things you do to one. */}
              {segment ? (
                <div className="mb-4 space-y-2 border border-emerald-700/60 bg-emerald-500/5 p-2.5">
                  <p className="text-[0.5625rem] uppercase tracking-[0.16em] text-emerald-300">
                    Segment {segment.index + 1}
                  </p>
                  <div className="grid grid-cols-1 gap-1">
                    <Btn
                      onClick={() => {
                        commit();
                        setDoc((d) => {
                          const w = d.objects.find((o) => o.uid === segment.uid);
                          if (!w || w.kind !== "wall") return d;
                          const [aId, bId] = segmentEnds(w, segment.index);
                          const a = d.nodes[aId], b = d.nodes[bId];
                          if (!a || !b) return d;
                          return splitSegment(d, segment.uid, segment.index, {
                            x: (a.x + b.x) / 2,
                            y: (a.y + b.y) / 2,
                          });
                        });
                      }}
                    >
                      Split wall here
                    </Btn>
                    <Btn
                      onClick={() => {
                        commit();
                        setDoc((d) => gapInSegment(d, segment.uid, segment.index, 0.38, 0.62));
                        setSegment(null);
                      }}
                    >
                      Create gap (door)
                    </Btn>
                    <Btn
                      tone="danger"
                      onClick={() => {
                        commit();
                        setDoc((d) => deleteSegment(d, segment.uid, segment.index));
                        setSegment(null);
                      }}
                    >
                      Delete segment
                    </Btn>
                  </div>
                  <p className="text-[0.625rem] leading-relaxed text-neutral-500">
                    Neighbouring segments keep their exact positions.
                  </p>
                </div>
              ) : null}

              {selected.length > 1 ? (
                <MultiInspector
                  count={selected.length}
                  onAlign={(m: AlignMode) => { commit(); setDoc((d) => alignObjects(d, sel, m)); }}
                  onDistribute={(axis) => { commit(); setDoc((d) => distributeObjects(d, sel, axis)); }}
                  onSpace={(axis, gap) => { commit(); setDoc((d) => spaceObjects(d, sel, axis, gap)); }}
                  onMatch={(what) => { commit(); setDoc((d) => matchSize(d, sel, what)); }}
                  onDelete={deleteSelection}
                  onDuplicate={duplicateSelection}
                  onLock={setLocked}
                  onOrder={reorder}
                  onFlip={flip}
                  onGroup={group}
                  onUngroup={ungroup}
                  onSetZone={setZone}
                  seatCount={selected.filter((o) => o.kind === "seat").length}
                  allLocked={selected.every((o) => o.locked)}
                  distance={pairDistance}
                />
              ) : single ? (
                <ObjectInspector
                  object={single}
                  onPatch={(p) => { commit(); patch(single.uid, p); }}
                  onDelete={deleteSelection}
                  onDuplicate={duplicateSelection}
                  onLock={setLocked}
                  onOrder={reorder}
                  onSelectSameType={() => selectSame("type")}
                  onSelectSameZone={() => selectSame("zone")}
                  onDetachNode={() => {
                    if (single.kind !== "wall") return;
                    commit();
                    setDoc((d) => {
                      let out = d;
                      single.nodes.forEach((id, i) => {
                        if (nodeDegree(d, id) > 1) out = detachNode(out, single.uid, i);
                      });
                      return out;
                    });
                  }}
                  sharedNodes={sharedNodeCount}
                />
              ) : (
                <div className="space-y-2.5 text-[0.75rem] leading-relaxed text-neutral-500">
                  <p className="text-[0.5625rem] uppercase tracking-[0.16em] text-neutral-400">Nothing selected</p>
                  <p>Click an object, or drag a box over several.</p>
                  <p className="tabular-nums">
                    {counts.bar} barski · {counts.high} visoki · {counts.booth} separe ·{" "}
                    {counts.bar + counts.high + counts.booth} total
                  </p>
                  <p className="tabular-nums text-neutral-600">{past.length} undo steps</p>
                </div>
              )}
            </div>

            <div className="shrink-0 border-t border-neutral-800 px-3 py-2">
              <p className="mb-1.5 text-[0.5rem] uppercase tracking-[0.16em] text-neutral-500">Reference fit</p>
              <div className="flex items-center gap-1">
                <Btn onClick={() => setRefFit((r) => ({ ...r, x: r.x - 5 }))}>←</Btn>
                <Btn onClick={() => setRefFit((r) => ({ ...r, x: r.x + 5 }))}>→</Btn>
                <Btn onClick={() => setRefFit((r) => ({ ...r, y: r.y - 5 }))}>↑</Btn>
                <Btn onClick={() => setRefFit((r) => ({ ...r, y: r.y + 5 }))}>↓</Btn>
                <Btn onClick={() => setRefFit((r) => ({ ...r, scale: r.scale * 1.02 }))}>+</Btn>
                <Btn onClick={() => setRefFit((r) => ({ ...r, scale: r.scale / 1.02 }))}>−</Btn>
                <Btn onClick={() => setRefFit({ x: 0, y: 0, scale: 1 })}>Reset</Btn>
              </div>
            </div>

            <div className="shrink-0 border-t border-neutral-800">
              <button type="button" onClick={() => setLayersOpen((v) => !v)}
                className="flex w-full items-center justify-between px-3 py-2 text-[0.5rem] uppercase tracking-[0.16em] text-neutral-400 hover:text-neutral-100">
                <span>{layersOpen ? "▾" : "▸"} Layers</span>
                <span className="tabular-nums text-neutral-600">{doc.objects.length}</span>
              </button>
              {layersOpen ? (
                <div className="max-h-[38vh] overflow-y-auto px-2 pb-2">
                  <EditorLayers
                    doc={doc}
                    selected={selSet}
                    onSelect={(uid, additive) =>
                      setSel((current) =>
                        !additive ? [uid] : current.includes(uid) ? current.filter((u) => u !== uid) : [...current, uid],
                      )
                    }
                    onToggleHidden={(uid) => {
                      const o = doc.objects.find((q) => q.uid === uid);
                      commit(); patch(uid, { hidden: !o?.hidden });
                    }}
                    onToggleLocked={(uid) => {
                      const o = doc.objects.find((q) => q.uid === uid);
                      commit(); patch(uid, { locked: !o?.locked });
                    }}
                    onGroupLock={(key, locked) => setGroupFlag(key, "locked", locked)}
                    onGroupHide={(key, hidden) => setGroupFlag(key, "hidden", hidden)}
                  />
                </div>
              ) : null}
            </div>
          </aside>
        ) : null}
      </div>

      {dataOpen ? (
        <div className="h-52 shrink-0 border-t border-neutral-800">
          <textarea
            readOnly value={serializeDoc(doc)} onFocus={(e) => e.currentTarget.select()}
            className="h-full w-full resize-none bg-neutral-900 p-3 font-mono text-[0.625rem] leading-relaxed text-neutral-300 outline-none"
          />
        </div>
      ) : null}
    </main>
  );
}

/* The editor draws its own L rather than importing the production path, so a
   change to how the map renders a corner separe cannot quietly move the thing
   you are dragging. Same geometry, stated once here. */
function cornerOutline(
  x: number, y: number, w: number, h: number, depth: number,
  corner: "tl" | "tr" | "bl" | "br",
) {
  const d = Math.max(2, Math.min(depth, Math.min(w, h) - 1));
  const r = x + w, b = y + h;
  const pts: [number, number][] =
    corner === "tl"
      ? [[x, y], [r, y], [r, y + d], [x + d, y + d], [x + d, b], [x, b]]
      : corner === "tr"
        ? [[x, y], [r, y], [r, b], [r - d, b], [r - d, y + d], [x, y + d]]
        : corner === "bl"
          ? [[x, y], [x + d, y], [x + d, b - d], [r, b - d], [r, b], [x, b]]
          : [[r, y], [r, b], [x, b], [x, b - d], [r - d, b - d], [r - d, y]];
  return `M ${pts.map((p) => p.join(" ")).join(" L ")} Z`;
}
