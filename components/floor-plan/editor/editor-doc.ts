import {
  ARROWS,
  LABELS,
  PASSAGES,
  ROOMS,
  SEATS,
  SEAT_KINDS,
  SEAT_PREFIX,
  SPIRALS,
  STRUCTURES,
  ZONE_MARK,
  ZONE_MARKS,
  seatSize,
  type CornerSide,
  type FloorSeat,
  type PlanLabel,
  type PlanStructure,
  type SeatType,
  type ZoneId,
} from "@/lib/floor-plan";

/* The editor's working copy of the club.
 *
 * On disk the plan is six arrays of different shapes. In here it is one flat
 * list plus a pool of shared points, because everything the editor does —
 * select, move, align, lock, hide, delete, undo — wants to treat a booth and a
 * wall the same way. The two forms meet at `loadDoc` and `serializeDoc`, and
 * nowhere else.
 *
 * WHY A NODE POOL. A wall does not own its corners; it names them. Two walls
 * that name the same node are joined, and joined is the whole point: dragging
 * that corner moves both, and no gap can open between them because there is
 * only one number. A T-junction is three walls naming one node. Detaching is
 * giving one wall a fresh node of its own at the same spot.
 *
 * Every object carries a `uid` that is the editor's own and never leaves it.
 * The `id` a table shows is the club's name for it and may be retyped at any
 * time; selection, history and the layer list all track the uid so renaming
 * something never drops it out from under you.
 *
 * Nothing here writes to disk. The editor prints TypeScript back out through
 * COPY FLOOR PLAN DATA and that text is pasted into lib/floor-plan.ts by hand,
 * which keeps that file the one source of truth. */

export type XY = { x: number; y: number };
export type NodeMap = Record<string, XY>;

export type Kind =
  | "seat" | "structure" | "spiral" | "passage" | "label" | "wall"
  | "stairs" | "fan" | "arrow" | "zonemark";

type Common = {
  uid: string;
  locked?: boolean;
  hidden?: boolean;
  /* Objects sharing a groupId are selected, moved and copied as one. It is a
     tag rather than a container: ungrouping is clearing it, and every member
     stays independently editable underneath. */
  groupId?: string;
};

export type EditorSeat = Common & {
  kind: "seat";
  id: string;
  type: SeatType;
  zone: ZoneId;
  /* The number this table shows — B12, V04, S07.
   *
   * Absent means it shows its id, which is how every table traced so far
   * stands and why nothing on the map moved the day this field arrived.
   *
   * `autoNumber` false takes a table out of the RENUMBER sweep and keeps
   * whatever was typed here, which is what the club's own internal numbers
   * will need the day they hand them over. Absent means auto: a table nobody
   * has spoken about is one the sweep may number. NOTHING recomputes these on
   * its own — see renumberSeats, which runs only when the button is pressed. */
  display?: string;
  autoNumber?: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  /* Set only on an L-shaped separe. Its type stays "booth", so a guest is
     never told the difference and the capacity is the booth's. */
  corner?: CornerSide;
  depth?: number;
};

export type EditorStructure = Common & {
  kind: "structure";
  id: string;
  skind: PlanStructure["kind"];
  x: number;
  y: number;
  w: number;
  h: number;
};

export type EditorSpiral = Common & {
  kind: "spiral";
  id: string;
  cx: number;
  cy: number;
  r: number;
  /* A flight that is not a true half-circle states its second radius, and a
     cut one its tread count. Both are carried rather than re-derived, so a
     plan loaded out of lib/floor-plan.ts goes back out unchanged. */
  ry?: number;
  steps?: number;
  from: number;
  to: number;
};

export type EditorPassage = Common & {
  kind: "passage";
  x: number;
  y: number;
  w: number;
  h: number;
};

export type EditorLabel = Common & {
  kind: "label";
  id: string;
  key: PlanLabel["key"];
  x: number;
  y: number;
  size: "zone" | "area";
  /* Written on the plan rather than translated — ŠANK, WC, ULAZ. When present
     it wins over `key`. Everything below falls back to the house treatment, so
     a label made before these existed is drawn exactly as it always was. */
  text?: string;
  fontSize?: number;
  rotation?: number;
  tracking?: number;
  opacity?: number;
  align?: "start" | "middle" | "end";
};

/* A straight flight. Serializes as a structure of kind "stairs-run", which the
   plan has always drawn — the editor just gives it a tread count and an angle. */
export type EditorStairs = Common & {
  kind: "stairs";
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  steps: number;
  /* Which way the flight climbs; drawn as the arrow along its axis. */
  direction: "up" | "down";
};

/* The fan: a semicircular flight. Serializes as a spiral, which is what the
   house's own curved stair already is. */
export type EditorFan = Common & {
  kind: "fan";
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  steps: number;
  /* How much of a turn the fan sweeps, in degrees. */
  arc: number;
  flipX?: boolean;
  flipY?: boolean;
};

/* The zone's numeral, standing behind the room. Serializes as a PlanZoneMark
   and is drawn by the map on the floor, under everything. It is not a label:
   it carries no text of its own, only which zone it names. */
export type EditorZoneMark = Common & {
  kind: "zonemark";
  id: string;
  zone: ZoneId;
  x: number;
  y: number;
  fontSize: number;
  rotation: number;
  opacity: number;
};

export type EditorArrow = Common & {
  kind: "arrow";
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width: number;
  head: number;
};

/* A hall is a closed chain of nodes; a wall drawn with the line tool is an
   open one. `curves[i]` is the quadratic control point for the segment leaving
   node i, or null where that segment is straight. */
export type EditorWall = Common & {
  kind: "wall";
  id: string;
  zone: ZoneId;
  nodes: string[];
  closed: boolean;
  curves: (XY | null)[];
};

export type EditorObject =
  | EditorSeat
  | EditorStructure
  | EditorSpiral
  | EditorPassage
  | EditorLabel
  | EditorWall
  | EditorStairs
  | EditorFan
  | EditorArrow
  | EditorZoneMark;

/* Straight-edges laid over the photograph while tracing. Editor furniture:
   never serialized, never seen by a guest. */
export type RefGuide = { id: string; axis: "x" | "y"; at: number };

export type EditorDoc = {
  objects: EditorObject[];
  nodes: NodeMap;
  guides: RefGuide[];
};

let counter = 0;
export const newUid = () => `u${++counter}`;

/* Adopt a document that was made in another session.
 *
 * Uids are handed out from a counter that `loadDoc` sets by counting the code
 * version. A restored draft may run far past that — a morning of tracing adds
 * hundreds — and without this the next object created would be handed a uid
 * that something in the draft already answers to, quietly welding two
 * unrelated objects together. Every restore path runs through here. */
export function reseedUids(doc: EditorDoc) {
  let max = 0;
  const scan = (id: string) => {
    const m = /^u(\d+)$/.exec(id);
    if (m) max = Math.max(max, Number(m[1]));
  };
  for (const o of doc.objects) scan(o.uid);
  for (const id of Object.keys(doc.nodes)) scan(id);
  for (const g of doc.guides ?? []) scan(g.id);
  counter = Math.max(counter, max);
  return doc;
}

export function loadDoc(): EditorDoc {
  counter = 0;
  const objects: EditorObject[] = [];
  const nodes: NodeMap = {};

  for (const r of ROOMS) {
    const ids = r.points.map((p) => {
      const id = newUid();
      nodes[id] = { x: p[0], y: p[1] };
      return id;
    });
    objects.push({
      uid: newUid(),
      kind: "wall",
      id: r.id,
      zone: r.zone,
      nodes: ids,
      /* Stated by the plan, never assumed. Forcing every chain closed on the
         way in draws a wall straight across the end of every open run — and
         then exports it, which is how a plan can come back with rooms it
         never had. Absent still means closed, because a hall written by hand
         says nothing and is one. */
      closed: r.closed !== false,
      curves: ids.map(() => null),
    });
  }
  for (const s of STRUCTURES) {
    /* A flight of stairs comes back as a flight of stairs, not as a plain
       box: the tread count and the angle live on the structure and would be
       dropped by the generic branch, so a plan that went out with a stair
       turned 270° and cut into seven would come back square and re-divided. */
    if (s.kind === "stairs-run") {
      objects.push({
        uid: newUid(), kind: "stairs", id: s.id,
        x: s.x, y: s.y, w: s.w, h: s.h,
        rotation: s.rotation ?? 0,
        /* The same default the map draws when a run states no count. */
        steps: s.steps ?? Math.max(3, Math.round(s.h / 20)),
        direction: "up",
      });
      continue;
    }
    objects.push({ uid: newUid(), kind: "structure", id: s.id, skind: s.kind, x: s.x, y: s.y, w: s.w, h: s.h });
  }
  for (const s of SPIRALS) {
    objects.push({
      uid: newUid(), kind: "spiral", id: s.id,
      cx: s.cx, cy: s.cy, r: s.r, ry: s.ry, steps: s.steps,
      from: s.from, to: s.to,
    });
  }
  for (const a of ARROWS) {
    objects.push({
      uid: newUid(), kind: "arrow", id: a.id,
      x1: a.x1, y1: a.y1, x2: a.x2, y2: a.y2,
      width: a.width ?? 2, head: a.head ?? 12,
    });
  }
  for (const p of PASSAGES) {
    objects.push({ uid: newUid(), kind: "passage", x: p.x, y: p.y, w: p.w, h: p.h });
  }
  for (const l of LABELS) {
    /* Every setting, not just where it stands. Dropping the text turns ŠANK,
       WC and ULAZ back into their translation key the moment the plan is
       reloaded from code, which is how five labels on the plan all came to
       read BINA. */
    objects.push({
      uid: newUid(), kind: "label", id: l.id, key: l.key, x: l.x, y: l.y, size: l.size,
      text: l.text, fontSize: l.fontSize, rotation: l.rotation,
      tracking: l.tracking, opacity: l.opacity, align: l.align,
    });
  }
  for (const m of ZONE_MARKS) {
    objects.push({
      uid: newUid(), kind: "zonemark", id: m.id, zone: m.zone, x: m.x, y: m.y,
      fontSize: m.fontSize ?? ZONE_MARK.fontSize,
      rotation: m.rotation ?? ZONE_MARK.rotation,
      opacity: m.opacity ?? ZONE_MARK.opacity,
    });
  }
  for (const s of SEATS) {
    const { w, h } = seatSize(s);
    objects.push({
      uid: newUid(),
      kind: "seat",
      id: s.id,
      type: s.type,
      zone: s.zone,
      display: s.display,
      autoNumber: s.autoNumber,
      x: s.x,
      y: s.y,
      w,
      h,
      rotation: s.rotation ?? 0,
      corner: s.corner,
      depth: s.depth,
    });
  }

  return { objects, nodes, guides: [] };
}

/* A document made before the zone numerals existed has none, and there is no
   way to draw one that is not there. So a restored draft is given the four
   defaults — and only if it has none at all, because a draft that has been
   arranged already must come back exactly as it was left.

   Additive and nothing else: no existing object is read, moved or replaced. */
export function withZoneMarks(doc: EditorDoc): EditorDoc {
  if (doc.objects.some((o) => o.kind === "zonemark")) return doc;
  const marks: EditorZoneMark[] = ZONE_MARKS.map((m) => ({
    uid: newUid(),
    kind: "zonemark",
    id: m.id,
    zone: m.zone,
    x: m.x,
    y: m.y,
    fontSize: m.fontSize ?? ZONE_MARK.fontSize,
    rotation: m.rotation ?? ZONE_MARK.rotation,
    opacity: m.opacity ?? ZONE_MARK.opacity,
  }));
  /* First in the list, which is the back of the drawing. */
  return { ...doc, objects: [...marks, ...doc.objects] };
}

/* What this table is called on the map, in the editor as on the plan. */
export const numberOf = (s: EditorSeat) => s.display?.trim() || s.id;

export const seatsOf = (doc: EditorDoc) =>
  doc.objects.filter((o): o is EditorSeat => o.kind === "seat");

export const wallsOf = (doc: EditorDoc) =>
  doc.objects.filter((o): o is EditorWall => o.kind === "wall");

export function wallPoints(w: EditorWall, nodes: NodeMap): XY[] {
  return w.nodes.map((id) => nodes[id]).filter(Boolean);
}

/* How many walls name this node — one means it is a free end, more means it is
   a join, and that is what the editor draws a ring around. */
export function nodeDegree(doc: EditorDoc, nodeId: string) {
  let n = 0;
  for (const o of doc.objects) {
    if (o.kind !== "wall") continue;
    n += o.nodes.filter((q) => q === nodeId).length;
  }
  return n;
}

/* Both an id and a shown number are counted here: once a floor has been
   renumbered the two diverge, and handing a new table an id that is already
   somebody else's number would put two B14s on the map. */
export function nextSeatId(doc: EditorDoc, type: SeatType) {
  const prefix = SEAT_PREFIX[type];
  const used = new Set<number>();
  for (const s of seatsOf(doc)) {
    for (const name of [s.id, numberOf(s)]) {
      if (!name.startsWith(prefix)) continue;
      const n = Number(name.slice(prefix.length));
      if (Number.isFinite(n)) used.add(n);
    }
  }
  let n = 1;
  while (used.has(n)) n++;
  return `${prefix}${String(n).padStart(2, "0")}`;
}

export function nextObjectId(doc: EditorDoc, kind: Kind, stem: string) {
  const used = new Set(
    doc.objects.filter((o) => o.kind === kind && "id" in o).map((o) => (o as { id: string }).id),
  );
  let n = 1;
  while (used.has(`${stem}-${n}`)) n++;
  return `${stem}-${n}`;
}

/* ── geometry every tool needs ──────────────────────────────────────────── */

export type Box = { x: number; y: number; w: number; h: number };

export function bboxOf(o: EditorObject, nodes: NodeMap): Box {
  switch (o.kind) {
    case "seat":
      return { x: o.x - o.w / 2, y: o.y - o.h / 2, w: o.w, h: o.h };
    case "structure":
    case "passage":
    case "stairs":
    case "fan":
      return { x: o.x, y: o.y, w: o.w, h: o.h };
    case "arrow": {
      const x = Math.min(o.x1, o.x2), y = Math.min(o.y1, o.y2);
      return { x, y, w: Math.abs(o.x2 - o.x1), h: Math.abs(o.y2 - o.y1) };
    }
    case "spiral":
      return { x: o.cx - o.r, y: o.cy - o.r, w: o.r * 2, h: o.r * 2 };
    case "label":
      return { x: o.x - 30, y: o.y - 9, w: 60, h: 18 };
    /* A numeral's own rough extent, so the handles sit on the figure rather
       than out in the room. Dragging one resizes the type — see the editor. */
    case "zonemark": {
      const w = o.fontSize * 0.62;
      const h = o.fontSize * 0.74;
      return { x: o.x - w / 2, y: o.y - h / 2, w, h };
    }
    case "wall": {
      const pts = wallPoints(o, nodes);
      if (pts.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
      const xs = pts.map((p) => p.x);
      const ys = pts.map((p) => p.y);
      const x = Math.min(...xs), y = Math.min(...ys);
      return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
    }
  }
}

export function unionBox(boxes: Box[]): Box | null {
  if (boxes.length === 0) return null;
  const x = Math.min(...boxes.map((b) => b.x));
  const y = Math.min(...boxes.map((b) => b.y));
  const r = Math.max(...boxes.map((b) => b.x + b.w));
  const bt = Math.max(...boxes.map((b) => b.y + b.h));
  return { x, y, w: r - x, h: bt - y };
}

/* Moving things.
 *
 * A wall moves by moving the nodes it names, so anything joined to it comes
 * along and the join survives. Nodes are gathered first and moved once, or a
 * corner shared by two selected walls would travel twice as far. */
export function translateObjects(
  doc: EditorDoc,
  uids: string[],
  dx: number,
  dy: number,
): EditorDoc {
  const chosen = new Set(uids);
  const nodeIds = new Set<string>();

  for (const o of doc.objects) {
    if (!chosen.has(o.uid) || o.locked) continue;
    if (o.kind === "wall") for (const id of o.nodes) nodeIds.add(id);
  }

  const nodes = { ...doc.nodes };
  for (const id of nodeIds) {
    const n = nodes[id];
    if (n) nodes[id] = { x: n.x + dx, y: n.y + dy };
  }

  const objects = doc.objects.map((o) => {
    if (!chosen.has(o.uid) || o.locked) return o;
    switch (o.kind) {
      case "seat":
      case "label":
      case "zonemark":
      case "structure":
      case "passage":
      case "stairs":
      case "fan":
        return { ...o, x: o.x + dx, y: o.y + dy };
      case "arrow":
        return { ...o, x1: o.x1 + dx, y1: o.y1 + dy, x2: o.x2 + dx, y2: o.y2 + dy };
      case "spiral":
        return { ...o, cx: o.cx + dx, cy: o.cy + dy };
      case "wall":
        return {
          ...o,
          curves: o.curves.map((c) => (c ? { x: c.x + dx, y: c.y + dy } : null)),
        };
    }
  });

  return { ...doc, objects, nodes };
}

/* Shift one object on its own, without touching the node pool. Walls are
   deliberately unchanged here — a wall moves by its corners, through
   `translateObjects`, so that anything joined to it comes along. */
export function moveObject<T extends EditorObject>(o: T, dx: number, dy: number): T {
  switch (o.kind) {
    case "seat":
    case "label":
    case "zonemark":
    case "structure":
    case "passage":
    case "stairs":
    case "fan":
      return { ...o, x: o.x + dx, y: o.y + dy };
    case "arrow":
      return { ...o, x1: o.x1 + dx, y1: o.y1 + dy, x2: o.x2 + dx, y2: o.y2 + dy };
    case "spiral":
      return { ...o, cx: o.cx + dx, cy: o.cy + dy };
    default:
      return o;
  }
}

/* Join two nodes into one: every wall naming `from` is made to name `into`. */
export function mergeNodes(doc: EditorDoc, from: string, into: string): EditorDoc {
  if (from === into) return doc;
  const objects = doc.objects.map((o) =>
    o.kind === "wall" && o.nodes.includes(from)
      ? { ...o, nodes: o.nodes.map((q) => (q === from ? into : q)) }
      : o,
  );
  const nodes = { ...doc.nodes };
  delete nodes[from];
  return { ...doc, objects, nodes };
}

/* The opposite: give one wall its own copy of a node it currently shares. */
export function detachNode(doc: EditorDoc, wallUid: string, index: number): EditorDoc {
  const wall = doc.objects.find((o) => o.uid === wallUid);
  if (!wall || wall.kind !== "wall") return doc;
  const oldId = wall.nodes[index];
  const point = doc.nodes[oldId];
  if (!point) return doc;

  const fresh = newUid();
  const nodes = { ...doc.nodes, [fresh]: { ...point } };
  const objects = doc.objects.map((o) =>
    o.uid === wallUid && o.kind === "wall"
      ? { ...o, nodes: o.nodes.map((q, i) => (i === index ? fresh : q)) }
      : o,
  );
  return { ...doc, objects, nodes };
}

/* ── working on one segment of a wall ───────────────────────────────────── */

/* How many segments a chain has: a closed outline has one per corner, an open
   run has one fewer. */
export function segmentCount(w: EditorWall) {
  return w.closed ? w.nodes.length : Math.max(0, w.nodes.length - 1);
}

export function segmentEnds(w: EditorWall, i: number): [string, string] {
  return [w.nodes[i], w.nodes[(i + 1) % w.nodes.length]];
}

/* Put a corner in the middle of one segment.
 *
 * A ─────── B becomes A ── C ── B, and nothing else about the chain moves.
 * The new corner is a node like any other, so a wall can be joined to it, it
 * can be dragged, and either half can then be removed on its own. */
export function splitSegment(doc: EditorDoc, wallUid: string, i: number, at: XY): EditorDoc {
  const wall = doc.objects.find((o) => o.uid === wallUid);
  if (!wall || wall.kind !== "wall") return doc;

  const fresh = newUid();
  const nodes = { ...doc.nodes, [fresh]: { x: at.x, y: at.y } };
  const objects = doc.objects.map((o) => {
    if (o.uid !== wallUid || o.kind !== "wall") return o;
    const next = [...o.nodes];
    next.splice(i + 1, 0, fresh);
    const curves = [...o.curves];
    /* A curved segment loses its bend when halved; guessing two control
       points from one would move the wall, and the wall must not move. */
    curves.splice(i, 1, null, null);
    return { ...o, nodes: next, curves };
  });
  return { ...doc, objects, nodes };
}

/* Remove one segment and leave its neighbours exactly where they are.
 *
 * A closed outline opens at that point rather than collapsing. An open run
 * splits into two runs when the cut is in the middle — which is what a doorway
 * in the middle of a wall actually is. Corners nobody names afterwards are
 * swept; corners another wall still names are left alone. */
export function deleteSegment(doc: EditorDoc, wallUid: string, i: number): EditorDoc {
  const wall = doc.objects.find((o) => o.uid === wallUid);
  if (!wall || wall.kind !== "wall") return doc;
  const count = segmentCount(wall);
  if (count <= 1) {
    return pruneNodes({ ...doc, objects: doc.objects.filter((o) => o.uid !== wallUid) });
  }

  if (wall.closed) {
    /* Opening the ring: re-cut the chain so it starts after the removed span. */
    const n = wall.nodes.length;
    const order = Array.from({ length: n }, (_, k) => wall.nodes[(i + 1 + k) % n]);
    const curves = Array.from({ length: n - 1 }, (_, k) => wall.curves[(i + 1 + k) % n] ?? null);
    const objects = doc.objects.map((o) =>
      o.uid === wallUid && o.kind === "wall"
        ? { ...o, nodes: order, closed: false, curves }
        : o,
    );
    return pruneNodes({ ...doc, objects });
  }

  /* An open run. Cutting an end shortens it; cutting the middle makes two. */
  if (i === 0) {
    const objects = doc.objects.map((o) =>
      o.uid === wallUid && o.kind === "wall"
        ? { ...o, nodes: o.nodes.slice(1), curves: o.curves.slice(1) }
        : o,
    );
    return pruneNodes({ ...doc, objects });
  }
  if (i === count - 1) {
    const objects = doc.objects.map((o) =>
      o.uid === wallUid && o.kind === "wall"
        ? { ...o, nodes: o.nodes.slice(0, -1), curves: o.curves.slice(0, -1) }
        : o,
    );
    return pruneNodes({ ...doc, objects });
  }

  const left: EditorWall = {
    ...wall,
    nodes: wall.nodes.slice(0, i + 1),
    curves: wall.curves.slice(0, i),
  };
  const right: EditorWall = {
    ...wall,
    uid: newUid(),
    id: `${wall.id}-b`,
    nodes: wall.nodes.slice(i + 1),
    curves: wall.curves.slice(i + 1),
  };
  const objects = doc.objects.flatMap((o) => (o.uid === wallUid ? [left, right] : [o]));
  return pruneNodes({ ...doc, objects });
}

/* A doorway in the middle of a run: two cuts and the piece between them goes.
   `from` and `to` are fractions along the segment. */
export function gapInSegment(
  doc: EditorDoc,
  wallUid: string,
  i: number,
  from: number,
  to: number,
): EditorDoc {
  const wall = doc.objects.find((o) => o.uid === wallUid);
  if (!wall || wall.kind !== "wall") return doc;
  const [aId, bId] = segmentEnds(wall, i);
  const a = doc.nodes[aId];
  const b = doc.nodes[bId];
  if (!a || !b) return doc;

  const lo = Math.max(0.02, Math.min(from, to));
  const hi = Math.min(0.98, Math.max(from, to));
  if (hi - lo < 0.02) return doc;

  const at = (t: number) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

  /* Two corners first, then the span between them is removed — so the wall
     either side keeps its exact bearing. */
  let out = splitSegment(doc, wallUid, i, at(lo));
  out = splitSegment(out, wallUid, i + 1, at(hi));
  return deleteSegment(out, wallUid, i + 1);
}

/* Nodes nobody names any more are swept after a wall is deleted. */
export function pruneNodes(doc: EditorDoc): EditorDoc {
  const used = new Set<string>();
  for (const o of doc.objects) if (o.kind === "wall") for (const id of o.nodes) used.add(id);
  const nodes: NodeMap = {};
  for (const [id, p] of Object.entries(doc.nodes)) if (used.has(id)) nodes[id] = p;
  return { ...doc, nodes };
}

export function zoneOf(o: EditorObject): ZoneId | null {
  if (o.kind === "seat" || o.kind === "wall" || o.kind === "zonemark") return o.zone;
  return null;
}

/* ── the shape of a wall, curves and all ────────────────────────────────── */

export function wallPath(w: EditorWall, nodes: NodeMap) {
  const pts = wallPoints(w, nodes);
  if (pts.length < 2) return "";
  let d = `M ${pts[0].x} ${pts[0].y}`;
  const segments = w.closed ? pts.length : pts.length - 1;
  for (let i = 0; i < segments; i++) {
    const to = pts[(i + 1) % pts.length];
    const c = w.curves[i];
    d += c ? ` Q ${c.x} ${c.y} ${to.x} ${to.y}` : ` L ${to.x} ${to.y}`;
  }
  if (w.closed) d += " Z";
  return d;
}

/* A curve has to become plain points on the way out, because PlanRoom carries
   points and nothing else. Eight samples a segment holds the shape closely
   enough to be indistinguishable at any zoom the map offers. */
function flatten(w: EditorWall, nodes: NodeMap): XY[] {
  const pts = wallPoints(w, nodes);
  if (pts.length < 2) return pts;
  const out: XY[] = [pts[0]];
  const segments = w.closed ? pts.length : pts.length - 1;
  for (let i = 0; i < segments; i++) {
    const from = pts[i];
    const to = pts[(i + 1) % pts.length];
    const c = w.curves[i];
    if (!c) {
      if (i < segments - 1 || !w.closed) out.push(to);
      continue;
    }
    for (let s = 1; s <= 8; s++) {
      const t = s / 8;
      const mt = 1 - t;
      const p = {
        x: mt * mt * from.x + 2 * mt * t * c.x + t * t * to.x,
        y: mt * mt * from.y + 2 * mt * t * c.y + t * t * to.y,
      };
      if (s === 8 && i === segments - 1 && w.closed) break;
      out.push(p);
    }
  }
  return out;
}

/* ── back to TypeScript ─────────────────────────────────────────────────── */

const r1 = (n: number) => Math.round(n * 10) / 10;
const num = (n: number) => String(Number.isInteger(n) ? n : r1(n));
/* A coordinate to a tenth of a pixel is exact enough for a room; a
   letter-spacing or an opacity to a tenth is not — 0.34em would go out as
   0.3em and come back as a different label. Anything that is a ratio rather
   than a distance is written at three decimals. */
const frac = (n: number) => String(Math.round(n * 1000) / 1000);
const normalized = (deg: number) => ((Math.round(deg) % 360) + 360) % 360;

/* A fan is authored as a box and stored as an arc.
 *
 * TWO RADII, NOT ONE. The flight used to take the smaller of its half-width
 * and its height, which meant one of the two numbers in the inspector did
 * nothing: a fan 200 wide and 40 deep drew as a 40-radius circle standing in a
 * 200-wide box. It now fills its box — half the width across, the full height
 * down — so width and height are both real and neither is forced to follow the
 * other. A flight that happens to be a true half-circle is simply one whose box
 * is twice as wide as it is deep.
 *
 * The box's own rotation turns the sweep; flipping turns the flight over
 * without touching the box, so a fan can face into the room whichever wall it
 * stands against. */
export function fanArc(f: EditorFan) {
  const cx = f.x + f.w / 2;
  /* Opening upward, the mouth of the fan is the foot of the box; flipped, it
     is the head of it, and the sweep hangs downward from there. */
  const cy = f.flipY ? f.y : f.y + f.h;
  const r = Math.max(4, f.w / 2);
  const ry = Math.max(4, f.h);
  const half = Math.max(10, Math.min(360, f.arc)) / 2;
  const centre = (f.flipY ? 90 : 270) + f.rotation;
  let from = centre - half;
  let to = centre + half;
  /* Mirrored about the box's own vertical, which is what turns a flight that
     climbs to the left into one that climbs to the right. */
  if (f.flipX) {
    const mirrored = [180 - to, 180 - from];
    from = mirrored[0];
    to = mirrored[1];
  }
  return { cx, cy, r, ry, from, to };
}

function seatLine(s: EditorSeat) {
  const kind = SEAT_KINDS[s.type];
  const parts = [
    `id: ${JSON.stringify(s.id)}`,
    `type: ${JSON.stringify(s.type)}`,
    `zone: ${s.zone}`,
  ];
  /* Only written where the two differ — a table whose number is its id says so
     by saying nothing, which is how every line in the file reads today. */
  if (s.display && s.display !== s.id) parts.push(`display: ${JSON.stringify(s.display)}`);
  /* Only ever written false — see FloorSeat.autoNumber. */
  if (s.autoNumber === false) parts.push(`autoNumber: false`);
  parts.push(`x: ${num(s.x)}`, `y: ${num(s.y)}`);
  if (Math.round(s.w) !== kind.size.w || Math.round(s.h) !== kind.size.h) {
    parts.push(`w: ${num(s.w)}`, `h: ${num(s.h)}`);
  }
  const rot = ((Math.round(s.rotation) % 360) + 360) % 360;
  if (rot !== 0) parts.push(`rotation: ${rot}`);
  if (s.corner) {
    parts.push(`corner: ${JSON.stringify(s.corner)}`, `depth: ${num(s.depth ?? 18)}`);
  }
  return `  { ${parts.join(", ")} },`;
}

export function serializeDoc(doc: EditorDoc) {
  const of = <T extends EditorObject["kind"]>(k: T) =>
    doc.objects.filter((o) => o.kind === k) as Extract<EditorObject, { kind: T }>[];

  const rooms = of("wall")
    .map((w) => {
      const pts = flatten(w, doc.nodes);
      return (
        `  {\n    id: ${JSON.stringify(w.id)},\n    zone: ${w.zone},\n` +
        /* Always written out, both ways round: an omitted flag means closed,
           so an open run that failed to say so would gain a wall. */
        `    closed: ${w.closed ? "true" : "false"},\n    points: [\n` +
        pts.map((p) => `      [${num(p.x)}, ${num(p.y)}],`).join("\n") +
        `\n    ],\n  },`
      );
    })
    .join("\n");

  /* Straight flights join the structures, which is what a "stairs-run" has
     always been; the tread count and angle ride along as optional fields. */
  const structures = [
    ...of("structure").map(
      (s) =>
        `  { id: ${JSON.stringify(s.id)}, kind: ${JSON.stringify(s.skind)}, x: ${num(s.x)}, y: ${num(s.y)}, w: ${num(s.w)}, h: ${num(s.h)} },`,
    ),
    ...of("stairs").map((s) => {
      const parts = [
        `id: ${JSON.stringify(s.id)}`,
        `kind: "stairs-run"`,
        `x: ${num(s.x)}`, `y: ${num(s.y)}`, `w: ${num(s.w)}`, `h: ${num(s.h)}`,
        `steps: ${Math.round(s.steps)}`,
      ];
      if (Math.round(s.rotation) % 360 !== 0) parts.push(`rotation: ${normalized(s.rotation)}`);
      return `  { ${parts.join(", ")} },`;
    }),
  ].join("\n");

  /* A fan is a spiral: the shape the house already drew for its curved stair,
     stated as a centre, a radius and a sweep. */
  const spirals = [
    ...of("spiral").map((s) => {
      const parts = [
        `id: ${JSON.stringify(s.id)}`,
        `cx: ${num(s.cx)}`, `cy: ${num(s.cy)}`, `r: ${num(s.r)}`,
      ];
      if (s.ry !== undefined && Math.round(s.ry * 10) !== Math.round(s.r * 10)) {
        parts.push(`ry: ${num(s.ry)}`);
      }
      parts.push(`from: ${num(s.from)}`, `to: ${num(s.to)}`);
      if (s.steps !== undefined) parts.push(`steps: ${Math.round(s.steps)}`);
      return `  { ${parts.join(", ")} },`;
    }),
    ...of("fan").map((f) => {
      const { cx, cy, r, ry, from, to } = fanArc(f);
      const parts = [
        `id: ${JSON.stringify(f.id)}`,
        `cx: ${num(cx)}`, `cy: ${num(cy)}`, `r: ${num(r)}`,
      ];
      /* A true half-circle states one radius, as the house's spiral does. */
      if (Math.round(ry * 10) !== Math.round(r * 10)) parts.push(`ry: ${num(ry)}`);
      parts.push(`from: ${num(from)}`, `to: ${num(to)}`, `steps: ${Math.round(f.steps)}`);
      return `  { ${parts.join(", ")} },`;
    }),
  ].join("\n");

  const arrows = of("arrow")
    .map(
      (a) =>
        `  { id: ${JSON.stringify(a.id)}, x1: ${num(a.x1)}, y1: ${num(a.y1)}, x2: ${num(a.x2)}, y2: ${num(a.y2)}, width: ${num(a.width)}, head: ${num(a.head)} },`,
    )
    .join("\n");

  const passages = of("passage")
    .map((p) => `  { x: ${num(p.x)}, y: ${num(p.y)}, w: ${num(p.w)}, h: ${num(p.h)} },`)
    .join("\n");

  const labels = of("label")
    .map((l) => {
      const parts = [
        `id: ${JSON.stringify(l.id)}`,
        `key: ${JSON.stringify(l.key)}`,
        `x: ${num(l.x)}`,
        `y: ${num(l.y)}`,
        `size: ${JSON.stringify(l.size)}`,
      ];
      /* Written whenever it exists, empty string included: a label whose text
         has been cleared draws nothing in the editor, and omitting the field
         would send it out to the map to be filled in from its translation key
         instead — a word appearing on the plan that nobody put there. */
      if (l.text !== undefined) parts.push(`text: ${JSON.stringify(l.text)}`);
      if (l.fontSize !== undefined) parts.push(`fontSize: ${num(l.fontSize)}`);
      if (l.rotation) parts.push(`rotation: ${normalized(l.rotation)}`);
      if (l.tracking !== undefined) parts.push(`tracking: ${frac(l.tracking)}`);
      if (l.opacity !== undefined && l.opacity !== 1) parts.push(`opacity: ${frac(l.opacity)}`);
      if (l.align && l.align !== "middle") parts.push(`align: ${JSON.stringify(l.align)}`);
      return `  { ${parts.join(", ")} },`;
    })
    .join("\n");

  const zoneMarks = of("zonemark")
    .map((m) => {
      const parts = [
        `id: ${JSON.stringify(m.id)}`,
        `zone: ${m.zone}`,
        `x: ${num(m.x)}`,
        `y: ${num(m.y)}`,
      ];
      if (Math.round(m.fontSize) !== ZONE_MARK.fontSize) parts.push(`fontSize: ${num(m.fontSize)}`);
      if (Math.round(m.rotation) % 360 !== 0) parts.push(`rotation: ${normalized(m.rotation)}`);
      if (Math.abs(m.opacity - ZONE_MARK.opacity) > 0.001) {
        parts.push(`opacity: ${Math.round(m.opacity * 1000) / 1000}`);
      }
      return `  { ${parts.join(", ")} },`;
    })
    .join("\n");

  const seats = of("seat").map(seatLine).join("\n");

  return `/* Laid out by hand at /floor-plan-editor, over the club's own drawing.
   Paste each array over its namesake in lib/floor-plan.ts.
   Curved wall segments are written out as sampled points — PlanRoom carries
   points and nothing else, and eight a segment holds the shape. */

export const ROOMS: PlanRoom[] = [
${rooms}
];

export const STRUCTURES: PlanStructure[] = [
${structures}
];

export const SPIRALS: PlanSpiral[] = [
${spirals}
];

export const ARROWS: PlanArrow[] = [
${arrows}
];

export const PASSAGES: PlanPassage[] = [
${passages}
];

export const LABELS: PlanLabel[] = [
${labels}
];

export const ZONE_MARKS: PlanZoneMark[] = [
${zoneMarks}
];

export const SEATS: FloorSeat[] = [
${seats}
];
`;
}

/* What PREVIEW hands the production map. */
export function docToFloorSeats(doc: EditorDoc): FloorSeat[] {
  return seatsOf(doc).map((s) => {
    const kind = SEAT_KINDS[s.type];
    const seat: FloorSeat = { id: s.id, type: s.type, zone: s.zone, x: s.x, y: s.y };
    if (s.display && s.display !== s.id) seat.display = s.display;
    if (Math.round(s.w) !== kind.size.w || Math.round(s.h) !== kind.size.h) {
      seat.w = s.w;
      seat.h = s.h;
    }
    const rot = ((Math.round(s.rotation) % 360) + 360) % 360;
    if (rot !== 0) seat.rotation = rot;
    if (s.corner) {
      seat.corner = s.corner;
      seat.depth = s.depth ?? 18;
    }
    if (s.autoNumber === false) seat.autoNumber = false;
    return seat;
  });
}

export function docToArchitecture(doc: EditorDoc) {
  const of = <T extends EditorObject["kind"]>(k: T) =>
    doc.objects.filter((o) => o.kind === k) as Extract<EditorObject, { kind: T }>[];
  return {
    rooms: of("wall").map((w) => ({
      id: w.id,
      zone: w.zone,
      points: flatten(w, doc.nodes).map((p) => [p.x, p.y] as [number, number]),
      /* Stated, never inferred. An open run must stay open in PREVIEW, or the
         map draws a segment the editor never showed. Compared against `true`
         rather than passed along, so a draft written before this flag existed
         resolves to open — which is the safe way to be wrong: a missing wall
         is visible and fixable, a phantom one across a room is neither. */
      closed: w.closed === true,
    })),
    structures: [
      ...of("structure").map((s) => ({ id: s.id, kind: s.skind, x: s.x, y: s.y, w: s.w, h: s.h })),
      ...of("stairs").map((s) => ({
        id: s.id, kind: "stairs-run" as const,
        x: s.x, y: s.y, w: s.w, h: s.h, steps: s.steps, rotation: s.rotation,
      })),
    ],
    spirals: [
      ...of("spiral").map((s) => ({
        id: s.id, cx: s.cx, cy: s.cy, r: s.r, ry: s.ry, steps: s.steps,
        from: s.from, to: s.to,
      })),
      ...of("fan").map((f) => ({ id: f.id, ...fanArc(f), steps: f.steps })),
    ],
    arrows: of("arrow").map((a) => ({ id: a.id, x1: a.x1, y1: a.y1, x2: a.x2, y2: a.y2, width: a.width, head: a.head })),
    zoneMarks: of("zonemark").map((m) => ({
      id: m.id, zone: m.zone, x: m.x, y: m.y,
      fontSize: m.fontSize, rotation: m.rotation, opacity: m.opacity,
    })),
    passages: of("passage").map((p) => ({ x: p.x, y: p.y, w: p.w, h: p.h })),
    labels: of("label").map((l) => ({
      id: l.id, key: l.key, x: l.x, y: l.y, size: l.size,
      text: l.text, fontSize: l.fontSize, rotation: l.rotation,
      tracking: l.tracking, opacity: l.opacity, align: l.align,
    })),
  };
}
