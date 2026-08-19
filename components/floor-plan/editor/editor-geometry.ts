import {
  bboxOf,
  translateObjects,
  unionBox,
  wallPoints,
  type Box,
  type EditorDoc,
  type EditorObject,
  type NodeMap,
  type XY,
} from "@/components/floor-plan/editor/editor-doc";

/* The maths behind the editor's manners.
 *
 * Everything here exists so a straight wall or an even row can be made without
 * typing a coordinate, and nothing here imposes a grid: a snap only ever
 * happens when something is already nearly aligned with something that is
 * actually on the plan. The club is irregular and stays irregular, and every
 * magnet can be overruled by dragging past it. */

/* ── smart guides ───────────────────────────────────────────────────────── */

export type Guide = { axis: "x" | "y"; at: number; from: number; to: number };

const edgesX = (b: Box) => [b.x, b.x + b.w / 2, b.x + b.w];
const edgesY = (b: Box) => [b.y, b.y + b.h / 2, b.y + b.h];

export function snapToGuides(
  moving: Box,
  others: Box[],
  rails: { axis: "x" | "y"; at: number }[],
  tolerance: number,
): { dx: number; dy: number; guides: Guide[] } {
  const guides: Guide[] = [];
  let dx = 0, dy = 0;
  let bestX = tolerance, bestY = tolerance;
  let hitX: { at: number; other: Box | null } | null = null;
  let hitY: { at: number; other: Box | null } | null = null;

  for (const o of others) {
    for (const mx of edgesX(moving))
      for (const ox of edgesX(o)) {
        const d = ox - mx;
        if (Math.abs(d) < bestX) { bestX = Math.abs(d); dx = d; hitX = { at: ox, other: o }; }
      }
    for (const my of edgesY(moving))
      for (const oy of edgesY(o)) {
        const d = oy - my;
        if (Math.abs(d) < bestY) { bestY = Math.abs(d); dy = d; hitY = { at: oy, other: o }; }
      }
  }

  /* Hand-placed straight-edges pull as hard as objects do. */
  for (const rail of rails) {
    const values = rail.axis === "x" ? edgesX(moving) : edgesY(moving);
    for (const v of values) {
      const d = rail.at - v;
      if (rail.axis === "x" && Math.abs(d) < bestX) { bestX = Math.abs(d); dx = d; hitX = { at: rail.at, other: null }; }
      if (rail.axis === "y" && Math.abs(d) < bestY) { bestY = Math.abs(d); dy = d; hitY = { at: rail.at, other: null }; }
    }
  }

  if (hitX) {
    const o = hitX.other;
    const from = o ? Math.min(moving.y, o.y) - 14 : moving.y - 40;
    const to = o ? Math.max(moving.y + moving.h, o.y + o.h) + 14 : moving.y + moving.h + 40;
    guides.push({ axis: "x", at: hitX.at, from, to });
  }
  if (hitY) {
    const o = hitY.other;
    const from = o ? Math.min(moving.x, o.x) - 14 : moving.x - 40;
    const to = o ? Math.max(moving.x + moving.w, o.x + o.w) + 14 : moving.x + moving.w + 40;
    guides.push({ axis: "y", at: hitY.at, from, to });
  }

  return { dx, dy, guides };
}

/* ── rotation ───────────────────────────────────────────────────────────── */

export const normalizeAngle = (deg: number) => ((Math.round(deg) % 360) + 360) % 360;

export function snapAngle(deg: number, shift: boolean): { angle: number; snapped: boolean } {
  const a = ((deg % 360) + 360) % 360;
  if (shift) return { angle: normalizeAngle(Math.round(a / 15) * 15), snapped: true };
  const near = (t: number, within: number) =>
    Math.abs(((a - t + 540) % 360) - 180) <= within;
  for (const t of [0, 90, 180, 270]) if (near(t, 6)) return { angle: t, snapped: true };
  for (const t of [45, 135, 225, 315]) if (near(t, 4)) return { angle: t, snapped: true };
  return { angle: normalizeAngle(a), snapped: false };
}

/* ── drawing and straightening walls ────────────────────────────────────── */

export type AngleLock = { point: XY; label: string | null };

/* Where the next wall corner really wants to go.
 *
 * Measured from the corner it is leaving: come within a few degrees of level,
 * plumb or a true diagonal and it locks exactly there, because a wall that is
 * nearly straight is worse than useless when the next one has to meet it.
 * Shift abandons the guesswork and forces the nearest eighth of a turn. */
export function lockToAngle(from: XY, to: XY, shift: boolean, tolerance = 6): AngleLock {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  if (len < 0.5) return { point: to, label: null };

  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  const project = (deg: number) => {
    const rad = (deg * Math.PI) / 180;
    return { x: from.x + Math.cos(rad) * len, y: from.y + Math.sin(rad) * len };
  };
  const name = (deg: number) => {
    const a = ((deg % 360) + 360) % 360;
    if (a === 0 || a === 180) return "HORIZONTAL";
    if (a === 90 || a === 270) return "VERTICAL";
    return `${a}°`;
  };

  if (shift) {
    const step = Math.round(angle / 45) * 45;
    return { point: project(step), label: name(step) };
  }

  let best: number | null = null;
  let bestErr = tolerance;
  for (const t of [0, 90, 180, -90]) {
    const err = Math.abs(((angle - t + 540) % 360) - 180);
    if (err < bestErr) { bestErr = err; best = t; }
  }
  if (best === null) {
    let dErr = 4;
    for (const t of [45, 135, -45, -135]) {
      const err = Math.abs(((angle - t + 540) % 360) - 180);
      if (err < dErr) { dErr = err; best = t; }
    }
  }
  return best === null ? { point: to, label: null } : { point: project(best), label: name(best) };
}

/* The nearest wall corner worth joining to, if there is one in reach. */
export function nearestNode(
  doc: EditorDoc,
  at: XY,
  within: number,
  exclude: Set<string>,
): string | null {
  let best: string | null = null;
  let bestD = within;
  for (const [id, p] of Object.entries(doc.nodes)) {
    if (exclude.has(id)) continue;
    const d = Math.hypot(p.x - at.x, p.y - at.y);
    if (d < bestD) { bestD = d; best = id; }
  }
  return best;
}

/* ── snapping a booth to the wall it stands against ─────────────────────── */

export type WallHit = { angle: number; distance: number };

/* The nearest wall segment's bearing, so a separe set against it can take the
   room's own angle instead of the page's. */
export function nearestWallAngle(
  doc: EditorDoc,
  nodes: NodeMap,
  at: XY,
  within: number,
): WallHit | null {
  let best: WallHit | null = null;

  for (const o of doc.objects) {
    if (o.kind !== "wall" || o.hidden) continue;
    const pts = wallPoints(o, nodes);
    const segments = o.closed ? pts.length : pts.length - 1;
    for (let i = 0; i < segments; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      if (!a || !b) continue;
      const vx = b.x - a.x, vy = b.y - a.y;
      const len2 = vx * vx + vy * vy;
      if (len2 < 1) continue;
      const t = Math.max(0, Math.min(1, ((at.x - a.x) * vx + (at.y - a.y) * vy) / len2));
      const px = a.x + vx * t, py = a.y + vy * t;
      const d = Math.hypot(at.x - px, at.y - py);
      if (d < within && (!best || d < best.distance)) {
        const deg = normalizeAngle((Math.atan2(vy, vx) * 180) / Math.PI);
        best = { angle: deg % 180, distance: d };
      }
    }
  }
  return best;
}

/* ── align, distribute, space, match ────────────────────────────────────── */

export type AlignMode = "left" | "centerH" | "right" | "top" | "centerV" | "bottom";

function shiftEach(
  doc: EditorDoc,
  deltas: { uid: string; dx: number; dy: number }[],
): EditorDoc {
  let out = doc;
  for (const d of deltas) {
    if (d.dx === 0 && d.dy === 0) continue;
    out = translateObjects(out, [d.uid], d.dx, d.dy);
  }
  return out;
}

export function alignObjects(doc: EditorDoc, uids: string[], mode: AlignMode): EditorDoc {
  const chosen = doc.objects.filter((o) => uids.includes(o.uid) && !o.locked);
  if (chosen.length < 2) return doc;
  const boxes = chosen.map((o) => bboxOf(o, doc.nodes));
  const bounds = unionBox(boxes);
  if (!bounds) return doc;

  const deltas = chosen.map((o, i) => {
    const b = boxes[i];
    switch (mode) {
      case "left": return { uid: o.uid, dx: bounds.x - b.x, dy: 0 };
      case "right": return { uid: o.uid, dx: bounds.x + bounds.w - b.w - b.x, dy: 0 };
      case "centerH": return { uid: o.uid, dx: bounds.x + bounds.w / 2 - b.w / 2 - b.x, dy: 0 };
      case "top": return { uid: o.uid, dx: 0, dy: bounds.y - b.y };
      case "bottom": return { uid: o.uid, dx: 0, dy: bounds.y + bounds.h - b.h - b.y };
      case "centerV": return { uid: o.uid, dx: 0, dy: bounds.y + bounds.h / 2 - b.h / 2 - b.y };
    }
  });
  return shiftEach(doc, deltas);
}

export function distributeObjects(doc: EditorDoc, uids: string[], axis: "x" | "y"): EditorDoc {
  const chosen = doc.objects.filter((o) => uids.includes(o.uid) && !o.locked);
  if (chosen.length < 3) return doc;

  const entries = chosen.map((o) => ({ o, b: bboxOf(o, doc.nodes) }));
  const centre = (b: Box) => (axis === "x" ? b.x + b.w / 2 : b.y + b.h / 2);
  const sorted = [...entries].sort((a, z) => centre(a.b) - centre(z.b));

  const first = centre(sorted[0].b);
  const last = centre(sorted[sorted.length - 1].b);
  const step = (last - first) / (sorted.length - 1);

  const deltas = sorted.map((entry, i) => {
    if (i === 0 || i === sorted.length - 1) return { uid: entry.o.uid, dx: 0, dy: 0 };
    const delta = first + step * i - centre(entry.b);
    return axis === "x"
      ? { uid: entry.o.uid, dx: delta, dy: 0 }
      : { uid: entry.o.uid, dx: 0, dy: delta };
  });
  return shiftEach(doc, deltas);
}

/* An exact gap between neighbours, measured edge to edge — which is what a row
   traced off a drawing usually wants rather than even centres. */
export function spaceObjects(
  doc: EditorDoc,
  uids: string[],
  axis: "x" | "y",
  gap: number,
): EditorDoc {
  const chosen = doc.objects.filter((o) => uids.includes(o.uid) && !o.locked);
  if (chosen.length < 2) return doc;

  const entries = chosen.map((o) => ({ o, b: bboxOf(o, doc.nodes) }));
  const start = (b: Box) => (axis === "x" ? b.x : b.y);
  const size = (b: Box) => (axis === "x" ? b.w : b.h);
  const sorted = [...entries].sort((a, z) => start(a.b) - start(z.b));

  let cursor = start(sorted[0].b) + size(sorted[0].b) + gap;
  const deltas = sorted.map((entry, i) => {
    if (i === 0) return { uid: entry.o.uid, dx: 0, dy: 0 };
    const delta = cursor - start(entry.b);
    cursor += size(entry.b) + gap;
    return axis === "x"
      ? { uid: entry.o.uid, dx: delta, dy: 0 }
      : { uid: entry.o.uid, dx: 0, dy: delta };
  });
  return shiftEach(doc, deltas);
}

/* Take the first-selected object's measurements for all the rest. */
export function matchSize(
  doc: EditorDoc,
  uids: string[],
  what: "w" | "h" | "both",
): EditorDoc {
  const order = uids.map((u) => doc.objects.find((o) => o.uid === u)).filter(Boolean) as EditorObject[];
  const master = order[0];
  if (!master) return doc;
  const mb = bboxOf(master, doc.nodes);

  const objects = doc.objects.map((o) => {
    if (o.uid === master.uid || !uids.includes(o.uid) || o.locked) return o;
    if (
      o.kind === "seat" || o.kind === "structure" || o.kind === "passage" ||
      o.kind === "stairs" || o.kind === "fan"
    ) {
      return {
        ...o,
        w: what === "h" ? o.w : mb.w,
        h: what === "w" ? o.h : mb.h,
      };
    }
    if (o.kind === "spiral" && what !== "h") return { ...o, r: mb.w / 2 };
    return o;
  });
  return { ...doc, objects };
}
