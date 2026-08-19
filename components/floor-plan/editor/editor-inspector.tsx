"use client";

import { useState } from "react";
import { SEAT_KINDS, ZONE_MARK, type CornerSide, type SeatType, type ZoneId } from "@/lib/floor-plan";
import type { EditorObject } from "@/components/floor-plan/editor/editor-doc";
import type { AlignMode } from "@/components/floor-plan/editor/editor-geometry";

/* The numbers behind whatever is selected, and the commands that act on more
   than one of them. Every box is live both ways: drag and the number follows,
   type and the object moves. Nothing here rounds or snaps on its own. */

function Num({
  label,
  value,
  onChange,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  suffix?: string;
}) {
  return (
    <label className="flex items-center justify-between gap-2">
      <span className="w-14 shrink-0 text-[0.5625rem] uppercase tracking-[0.16em] text-neutral-500">
        {label}
      </span>
      <input
        type="number"
        value={Math.round(value * 10) / 10}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange(n);
        }}
        className="w-full border border-neutral-700 bg-neutral-900 px-2 py-1 text-right text-[0.8125rem] tabular-nums text-neutral-100 outline-none focus:border-amber-500/70"
      />
      {suffix ? <span className="text-[0.625rem] text-neutral-600">{suffix}</span> : null}
    </label>
  );
}

function Text({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-2">
      <span className="w-14 shrink-0 text-[0.5625rem] uppercase tracking-[0.16em] text-neutral-500">
        {label}
      </span>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-neutral-700 bg-neutral-900 px-2 py-1 text-right font-mono text-[0.8125rem] text-neutral-100 outline-none placeholder:text-neutral-600 focus:border-amber-500/70"
      />
    </label>
  );
}

export function Btn({
  children,
  onClick,
  title,
  tone = "plain",
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title?: string;
  tone?: "plain" | "danger" | "on";
  disabled?: boolean;
}) {
  const tones = {
    plain: "border-neutral-700 text-neutral-300 hover:border-amber-500/70 hover:text-amber-300",
    danger: "border-red-900/70 text-red-300 hover:border-red-500 hover:text-red-200",
    on: "border-amber-500 bg-amber-500/15 text-amber-300",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={`border px-2 py-1.5 text-[0.5625rem] uppercase tracking-[0.1em] disabled:opacity-30 ${tones[tone]}`}
    >
      {children}
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[0.5625rem] uppercase tracking-[0.16em] text-neutral-500">{title}</p>
      {children}
    </div>
  );
}

/* ── several selected ───────────────────────────────────────────────────── */

export function MultiInspector({
  count,
  onAlign,
  onDistribute,
  onSpace,
  onMatch,
  onDelete,
  onDuplicate,
  onLock,
  onOrder,
  onFlip,
  onGroup,
  onUngroup,
  onSetZone,
  seatCount,
  allLocked,
  distance,
}: {
  count: number;
  onAlign: (mode: AlignMode) => void;
  onDistribute: (axis: "x" | "y") => void;
  onSpace: (axis: "x" | "y", gap: number) => void;
  onMatch: (what: "w" | "h" | "both") => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onLock: (locked: boolean) => void;
  onOrder: (where: "front" | "forward" | "backward" | "back") => void;
  onFlip: (axis: "x" | "y") => void;
  onGroup: () => void;
  onUngroup: () => void;
  onSetZone: (zone: ZoneId) => void;
  /* How many of the selection are tables, which is all SET ZONE can act on. */
  seatCount: number;
  allLocked: boolean;
  distance: number | null;
}) {
  const [gap, setGap] = useState(20);

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <p className="text-[0.625rem] uppercase tracking-[0.18em] text-amber-400">
          {count} selected
        </p>
        {distance !== null ? (
          <p className="text-[0.625rem] tabular-nums text-neutral-500">{Math.round(distance)} px apart</p>
        ) : null}
      </div>

      <Section title="Align">
        <div className="grid grid-cols-3 gap-1">
          <Btn onClick={() => onAlign("left")} title="Align left">L</Btn>
          <Btn onClick={() => onAlign("centerH")} title="Centre horizontally">C·H</Btn>
          <Btn onClick={() => onAlign("right")} title="Align right">R</Btn>
          <Btn onClick={() => onAlign("top")} title="Align top">T</Btn>
          <Btn onClick={() => onAlign("centerV")} title="Centre vertically">C·V</Btn>
          <Btn onClick={() => onAlign("bottom")} title="Align bottom">B</Btn>
        </div>
      </Section>

      <Section title="Distribute evenly">
        <div className="grid grid-cols-2 gap-1">
          <Btn onClick={() => onDistribute("x")} disabled={count < 3}>Horizontal</Btn>
          <Btn onClick={() => onDistribute("y")} disabled={count < 3}>Vertical</Btn>
        </div>
      </Section>

      <Section title="Space by exact gap">
        <div className="flex items-center gap-1">
          <input
            type="number"
            value={gap}
            onChange={(e) => setGap(Number(e.target.value) || 0)}
            className="w-14 border border-neutral-700 bg-neutral-900 px-1.5 py-1 text-right text-[0.75rem] tabular-nums text-neutral-100 outline-none focus:border-amber-500/70"
          />
          <Btn onClick={() => onSpace("x", gap)}>Space H</Btn>
          <Btn onClick={() => onSpace("y", gap)}>Space V</Btn>
        </div>
      </Section>

      <Section title="Match the first selected">
        <div className="grid grid-cols-3 gap-1">
          <Btn onClick={() => onMatch("w")}>Width</Btn>
          <Btn onClick={() => onMatch("h")}>Height</Btn>
          <Btn onClick={() => onMatch("both")}>Size</Btn>
        </div>
      </Section>

      <Section title="Order">
        <div className="grid grid-cols-4 gap-1">
          <Btn onClick={() => onOrder("back")} title="Send to back">⤓</Btn>
          <Btn onClick={() => onOrder("backward")} title="Send backward">↓</Btn>
          <Btn onClick={() => onOrder("forward")} title="Bring forward">↑</Btn>
          <Btn onClick={() => onOrder("front")} title="Bring to front">⤒</Btn>
        </div>
      </Section>

      <Section title="Flip">
        <div className="grid grid-cols-2 gap-1">
          <Btn onClick={() => onFlip("x")}>Horizontal</Btn>
          <Btn onClick={() => onFlip("y")}>Vertical</Btn>
        </div>
      </Section>

      {/* Zone before numbering: RENUMBER walks the club zone by zone, so a
          table in the wrong zone gets the wrong number however carefully it is
          placed. Setting fifty at once is the difference between a minute and
          an afternoon. */}
      {seatCount > 0 ? (
        <Section title={`Set zone · ${seatCount} ${seatCount === 1 ? "table" : "tables"}`}>
          <div className="grid grid-cols-4 gap-1">
            {([1, 2, 3, 4] as ZoneId[]).map((z) => (
              <Btn key={z} onClick={() => onSetZone(z)} title={z === 4 ? "Galerija" : `Zona ${z}`}>
                {z === 4 ? "4 · G" : String(z)}
              </Btn>
            ))}
          </div>
        </Section>
      ) : null}

      <Section title="Group">
        <div className="grid grid-cols-2 gap-1">
          <Btn onClick={onGroup}>Group</Btn>
          <Btn onClick={onUngroup}>Ungroup</Btn>
        </div>
      </Section>

      <div className="grid grid-cols-3 gap-1">
        <Btn onClick={onDuplicate}>Copy</Btn>
        <Btn onClick={() => onLock(!allLocked)} tone={allLocked ? "on" : "plain"}>
          {allLocked ? "Unlock" : "Lock"}
        </Btn>
        <Btn onClick={onDelete} tone="danger">Delete</Btn>
      </div>
    </div>
  );
}

/* ── one selected ───────────────────────────────────────────────────────── */

const CORNERS: { side: CornerSide; label: string }[] = [
  { side: "tl", label: "Top left" },
  { side: "tr", label: "Top right" },
  { side: "bl", label: "Bottom left" },
  { side: "br", label: "Bottom right" },
];

export function ObjectInspector({
  object,
  onPatch,
  onDelete,
  onDuplicate,
  onLock,
  onOrder,
  onSelectSameType,
  onSelectSameZone,
  onDetachNode,
  sharedNodes,
}: {
  object: EditorObject;
  onPatch: (patch: Record<string, unknown>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onLock: (locked: boolean) => void;
  onOrder: (where: "front" | "forward" | "backward" | "back") => void;
  onSelectSameType: () => void;
  onSelectSameZone: () => void;
  onDetachNode: () => void;
  sharedNodes: number;
}) {
  const locked = Boolean(object.locked);

  const header = (
    <div className="flex items-center justify-between gap-2">
      {"id" in object ? (
        <input
          value={object.id}
          onChange={(e) => onPatch({ id: e.target.value })}
          className="w-32 border border-neutral-700 bg-neutral-900 px-2 py-1 font-mono text-[0.8125rem] text-amber-300 outline-none focus:border-amber-500/70"
        />
      ) : (
        <span className="font-mono text-[0.8125rem] text-amber-300">passage</span>
      )}
      <Btn onClick={() => onLock(!locked)} tone={locked ? "on" : "plain"}>
        {locked ? "Locked" : "Lock"}
      </Btn>
    </div>
  );

  const order = (
    <Section title="Order">
      <div className="grid grid-cols-4 gap-1">
        <Btn onClick={() => onOrder("back")} title="Send to back">⤓</Btn>
        <Btn onClick={() => onOrder("backward")} title="Send backward">↓</Btn>
        <Btn onClick={() => onOrder("forward")} title="Bring forward">↑</Btn>
        <Btn onClick={() => onOrder("front")} title="Bring to front">⤒</Btn>
      </div>
    </Section>
  );

  const footer = (
    <div className="grid grid-cols-2 gap-1 pt-1">
      <Btn onClick={onDuplicate}>Duplicate</Btn>
      <Btn onClick={onDelete} tone="danger">Delete</Btn>
    </div>
  );

  if (object.kind === "seat") {
    const kind = SEAT_KINDS[object.type];
    const isCorner = Boolean(object.corner);
    const auto = object.autoNumber !== false;
    const shown = object.display?.trim() || object.id;
    return (
      <div className="space-y-3.5">
        {header}
        <p className="text-[0.5625rem] uppercase tracking-[0.16em] text-neutral-500">
          {shown} · {isCorner ? "Corner separe" : "Table"} · {kind.capacity.min}–
          {kind.capacity.max}
        </p>

        <div className="grid grid-cols-2 gap-1.5">
          <label>
            <span className="mb-1 block text-[0.5625rem] uppercase tracking-[0.16em] text-neutral-500">Type</span>
            <select
              value={object.type}
              onChange={(e) => onPatch({ type: e.target.value as SeatType })}
              className="w-full border border-neutral-700 bg-neutral-900 px-1.5 py-1 text-[0.6875rem] text-neutral-100 outline-none focus:border-amber-500/70"
            >
              <option value="bar">Barski sto</option>
              <option value="high">Visoki sto</option>
              <option value="booth">Separe</option>
            </select>
          </label>
          <label>
            <span className="mb-1 block text-[0.5625rem] uppercase tracking-[0.16em] text-neutral-500">Zone</span>
            <select
              value={object.zone}
              onChange={(e) => onPatch({ zone: Number(e.target.value) as ZoneId })}
              className="w-full border border-neutral-700 bg-neutral-900 px-1.5 py-1 text-[0.6875rem] text-neutral-100 outline-none focus:border-amber-500/70"
            >
              <option value={1}>Zona 1</option>
              <option value={2}>Zona 2</option>
              <option value={3}>Zona 3</option>
              <option value={4}>Galerija</option>
            </select>
          </label>
        </div>

        <div className="space-y-1">
          <Num label="X" value={object.x} onChange={(x) => onPatch({ x })} />
          <Num label="Y" value={object.y} onChange={(y) => onPatch({ y })} />
          <Num label={isCorner ? "Arm A" : "W"} value={object.w} onChange={(w) => onPatch({ w: Math.max(6, w) })} />
          <Num label={isCorner ? "Arm B" : "H"} value={object.h} onChange={(h) => onPatch({ h: Math.max(6, h) })} />
          {isCorner ? (
            <Num
              label="Depth"
              value={object.depth ?? 18}
              onChange={(d) => onPatch({ depth: Math.max(3, d) })}
            />
          ) : null}
          <Num label="Angle" value={object.rotation} onChange={(r) => onPatch({ rotation: ((Math.round(r) % 360) + 360) % 360 })} />
        </div>

        <div className="grid grid-cols-4 gap-1">
          {[0, 90, 180, 270].map((a) => (
            <Btn key={a} onClick={() => onPatch({ rotation: a })} tone={object.rotation === a ? "on" : "plain"}>
              {a}°
            </Btn>
          ))}
        </div>

        {object.type === "booth" ? (
          <Section title="Corner elbow">
            <div className="grid grid-cols-2 gap-1">
              {CORNERS.map((c) => (
                <Btn
                  key={c.side}
                  onClick={() => onPatch({ corner: c.side, depth: object.depth ?? 18 })}
                  tone={object.corner === c.side ? "on" : "plain"}
                >
                  {c.label}
                </Btn>
              ))}
            </div>
            {isCorner ? (
              <div className="mt-1">
                <Btn onClick={() => onPatch({ corner: undefined, depth: undefined })}>
                  Straight separe
                </Btn>
              </div>
            ) : null}
          </Section>
        ) : null}

        {/* What this table is called on the map.
            AUTO leaves it to RENUMBER TABLES, which walks the club zone by
            zone and hands out B/V/S numbers in reading order. MANUAL holds
            whatever is typed here against every future sweep — which is what
            the club's own internal numbers will need, the day they give us
            them. Neither one renumbers anything on its own. */}
        <Section title="Number">
          <div className="mb-1 grid grid-cols-2 gap-1">
            <Btn
              onClick={() => onPatch({ autoNumber: true })}
              tone={auto ? "on" : "plain"}
              title="Numbered by RENUMBER TABLES"
            >
              Auto
            </Btn>
            <Btn
              onClick={() => onPatch({ autoNumber: false, display: shown })}
              tone={auto ? "plain" : "on"}
              title="Held at whatever is typed below"
            >
              Manual
            </Btn>
          </div>
          <Text
            label="Shows"
            value={object.display ?? ""}
            placeholder={object.id}
            /* Typing a number is stating one, so it holds: the sweep would
               otherwise take it straight back the next time it ran. Clearing
               the box hands the table back to the sequence. */
            onChange={(v) =>
              onPatch({ display: v, autoNumber: v.trim() === "" })
            }
          />
          <p className="mt-1 text-[0.625rem] leading-relaxed text-neutral-600">
            {auto
              ? object.display
                ? `Shows ${object.display} · id ${object.id} · RENUMBER may change it`
                : `Shows its id, ${object.id}, until RENUMBER TABLES is pressed`
              : `Held at ${shown} · RENUMBER steps over it`}
          </p>
        </Section>

        <Section title="Select">
          <div className="grid grid-cols-2 gap-1">
            <Btn onClick={onSelectSameType}>Same type</Btn>
            <Btn onClick={onSelectSameZone}>Same zone</Btn>
          </div>
        </Section>

        {order}
        {footer}
      </div>
    );
  }

  if (object.kind === "wall") {
    return (
      <div className="space-y-3.5">
        {header}
        <p className="text-[0.5625rem] uppercase tracking-[0.16em] text-neutral-500">
          {object.closed ? "Closed outline" : "Wall"} · {object.nodes.length} nodes
          {sharedNodes > 0 ? ` · ${sharedNodes} joined` : ""}
        </p>
        <p className="text-[0.6875rem] leading-relaxed text-neutral-500">
          Turn on NODES in the toolbar to drag corners. A corner dropped on another
          joins to it and the two move as one. Drag a segment&apos;s midpoint to curve
          it; double-click that handle to straighten it again.
        </p>
        {sharedNodes > 0 ? (
          <Btn onClick={onDetachNode}>Detach this wall from its joins</Btn>
        ) : null}
        <label className="flex items-center gap-2 text-[0.625rem] uppercase tracking-[0.12em] text-neutral-400">
          <input
            type="checkbox"
            checked={object.closed}
            onChange={(e) => onPatch({ closed: e.target.checked })}
          />
          Closed
        </label>
        {order}
        {footer}
      </div>
    );
  }

  if (object.kind === "spiral") {
    return (
      <div className="space-y-3.5">
        {header}
        <p className="text-[0.5625rem] uppercase tracking-[0.16em] text-neutral-500">Stairs</p>
        <div className="space-y-1">
          <Num label="X" value={object.cx} onChange={(cx) => onPatch({ cx })} />
          <Num label="Y" value={object.cy} onChange={(cy) => onPatch({ cy })} />
          <Num label="R" value={object.r} onChange={(r) => onPatch({ r: Math.max(4, r) })} />
          <Num label="From" value={object.from} onChange={(from) => onPatch({ from })} />
          <Num label="To" value={object.to} onChange={(to) => onPatch({ to })} />
        </div>
        {order}
        {footer}
      </div>
    );
  }

  if (object.kind === "label") {
    return (
      <div className="space-y-3.5">
        {header}
        <Section title="Text">
          <input
            value={object.text ?? ""}
            placeholder={object.key}
            onChange={(e) => onPatch({ text: e.target.value })}
            className="w-full border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-[0.8125rem] text-neutral-100 outline-none focus:border-amber-500/70"
          />
          <p className="mt-1 text-[0.625rem] leading-relaxed text-neutral-600">
            {object.text
              ? "Set as written, in any language."
              : `Empty — translated from ${object.key}.`}
          </p>
        </Section>

        <div className="space-y-1">
          <Num label="X" value={object.x} onChange={(x) => onPatch({ x })} />
          <Num label="Y" value={object.y} onChange={(y) => onPatch({ y })} />
          <Num
            label="Size"
            value={object.fontSize ?? (object.size === "area" ? 13 : 15)}
            onChange={(v) => onPatch({ fontSize: Math.max(8, Math.min(120, v)) })}
          />
          <Num
            label="Tracking"
            value={object.tracking ?? 0.34}
            onChange={(v) => onPatch({ tracking: Math.max(0, v) })}
          />
          <Num
            label="Angle"
            value={object.rotation ?? 0}
            onChange={(r) => onPatch({ rotation: ((Math.round(r) % 360) + 360) % 360 })}
          />
          <Num
            label="Opacity"
            value={object.opacity ?? 1}
            onChange={(v) => onPatch({ opacity: Math.max(0.05, Math.min(1, v)) })}
          />
        </div>

        <Section title="Preset">
          <div className="grid grid-cols-3 gap-1">
            <Btn onClick={() => onPatch({ fontSize: 11 })}>Small</Btn>
            <Btn onClick={() => onPatch({ fontSize: 20 })}>Medium</Btn>
            <Btn onClick={() => onPatch({ fontSize: 40 })}>Large</Btn>
          </div>
        </Section>

        <Section title="Align">
          <div className="grid grid-cols-3 gap-1">
            {(["start", "middle", "end"] as const).map((a) => (
              <Btn
                key={a}
                onClick={() => onPatch({ align: a })}
                tone={(object.align ?? "middle") === a ? "on" : "plain"}
              >
                {a === "start" ? "Left" : a === "middle" ? "Centre" : "Right"}
              </Btn>
            ))}
          </div>
        </Section>

        {order}
        {footer}
      </div>
    );
  }

  if (object.kind === "stairs") {
    return (
      <div className="space-y-3.5">
        {header}
        <p className="text-[0.5625rem] uppercase tracking-[0.16em] text-neutral-500">Stepenice</p>
        <div className="space-y-1">
          <Num label="X" value={object.x} onChange={(x) => onPatch({ x })} />
          <Num label="Y" value={object.y} onChange={(y) => onPatch({ y })} />
          <Num label="W" value={object.w} onChange={(w) => onPatch({ w: Math.max(8, w) })} />
          <Num label="H" value={object.h} onChange={(h) => onPatch({ h: Math.max(8, h) })} />
          <Num
            label="Steps"
            value={object.steps}
            onChange={(s) => onPatch({ steps: Math.max(2, Math.round(s)) })}
          />
          <Num
            label="Angle"
            value={object.rotation}
            onChange={(r) => onPatch({ rotation: ((Math.round(r) % 360) + 360) % 360 })}
          />
        </div>
        <div className="grid grid-cols-4 gap-1">
          {[0, 90, 180, 270].map((a) => (
            <Btn key={a} onClick={() => onPatch({ rotation: a })} tone={object.rotation === a ? "on" : "plain"}>
              {a}°
            </Btn>
          ))}
        </div>
        <Section title="Direction">
          <div className="grid grid-cols-2 gap-1">
            <Btn onClick={() => onPatch({ direction: "up" })} tone={object.direction === "up" ? "on" : "plain"}>Up</Btn>
            <Btn onClick={() => onPatch({ direction: "down" })} tone={object.direction === "down" ? "on" : "plain"}>Down</Btn>
          </div>
          <p className="mt-1 text-[0.625rem] leading-relaxed text-neutral-600">
            Drag any handle to change width and height freely; shift keeps the
            proportion. The treads divide whatever height it ends up at.
          </p>
        </Section>
        {order}
        {footer}
      </div>
    );
  }

  if (object.kind === "fan") {
    return (
      <div className="space-y-3.5">
        {header}
        <p className="text-[0.5625rem] uppercase tracking-[0.16em] text-neutral-500">
          Polukružne stepenice
        </p>
        <div className="space-y-1">
          <Num label="X" value={object.x} onChange={(x) => onPatch({ x })} />
          <Num label="Y" value={object.y} onChange={(y) => onPatch({ y })} />
          <Num label="W" value={object.w} onChange={(w) => onPatch({ w: Math.max(10, w) })} />
          <Num label="H" value={object.h} onChange={(h) => onPatch({ h: Math.max(10, h) })} />
          <Num
            label="Steps"
            value={object.steps}
            onChange={(s) => onPatch({ steps: Math.max(2, Math.round(s)) })}
          />
          <Num
            label="Arc"
            value={object.arc}
            onChange={(a) => onPatch({ arc: Math.max(10, Math.min(360, a)) })}
            suffix="°"
          />
          <Num
            label="Angle"
            value={object.rotation}
            onChange={(r) => onPatch({ rotation: ((Math.round(r) % 360) + 360) % 360 })}
          />
        </div>
        <Section title="Faces">
          <div className="grid grid-cols-4 gap-1">
            <Btn onClick={() => onPatch({ rotation: 0 })} tone={object.rotation === 0 ? "on" : "plain"}>Top</Btn>
            <Btn onClick={() => onPatch({ rotation: 90 })} tone={object.rotation === 90 ? "on" : "plain"}>Right</Btn>
            <Btn onClick={() => onPatch({ rotation: 180 })} tone={object.rotation === 180 ? "on" : "plain"}>Bottom</Btn>
            <Btn onClick={() => onPatch({ rotation: 270 })} tone={object.rotation === 270 ? "on" : "plain"}>Left</Btn>
          </div>
        </Section>

        {/* Turning the flight over inside its own box — how a fan is set
            against the opposite wall without dragging it again. */}
        <Section title="Flip">
          <div className="grid grid-cols-2 gap-1">
            <Btn onClick={() => onPatch({ flipX: !object.flipX })} tone={object.flipX ? "on" : "plain"}>
              Mirror ⇋
            </Btn>
            <Btn onClick={() => onPatch({ flipY: !object.flipY })} tone={object.flipY ? "on" : "plain"}>
              Turn over ⇵
            </Btn>
          </div>
          <p className="mt-1 text-[0.625rem] leading-relaxed text-neutral-600">
            The fan fills its box: W is the full span, H the depth, and neither
            follows the other. Drag any handle — shift keeps the proportion.
          </p>
        </Section>
        {order}
        {footer}
      </div>
    );
  }

  if (object.kind === "zonemark") {
    return (
      <div className="space-y-3.5">
        {header}
        <p className="text-[0.5625rem] uppercase tracking-[0.16em] text-neutral-500">
          Zone number · {object.zone === 4 ? "Galerija" : `Zona ${object.zone}`}
        </p>
        <p className="text-[0.6875rem] leading-relaxed text-neutral-500">
          Drawn on the floor, behind the walls and every table, and never
          clickable outside this editor. It is an orientation aid rather than
          signage: keep it faint enough to be read without being looked at.
        </p>

        <label>
          <span className="mb-1 block text-[0.5625rem] uppercase tracking-[0.16em] text-neutral-500">Zone</span>
          <select
            value={object.zone}
            onChange={(e) => onPatch({ zone: Number(e.target.value) as ZoneId })}
            className="w-full border border-neutral-700 bg-neutral-900 px-1.5 py-1 text-[0.6875rem] text-neutral-100 outline-none focus:border-amber-500/70"
          >
            <option value={1}>1 · Zona 1</option>
            <option value={2}>2 · Zona 2</option>
            <option value={3}>3 · Zona 3</option>
            <option value={4}>4 · Galerija</option>
          </select>
        </label>

        <div className="space-y-1">
          <Num label="X" value={object.x} onChange={(x) => onPatch({ x })} />
          <Num label="Y" value={object.y} onChange={(y) => onPatch({ y })} />
          <Num
            label="Size"
            value={object.fontSize}
            onChange={(v) => onPatch({ fontSize: Math.max(20, Math.min(900, v)) })}
          />
          <Num
            label="Angle"
            value={object.rotation}
            onChange={(r) => onPatch({ rotation: ((Math.round(r) % 360) + 360) % 360 })}
          />
          <Num
            label="Opacity"
            value={Math.round(object.opacity * 100)}
            onChange={(v) => onPatch({ opacity: Math.max(0.01, Math.min(1, v / 100)) })}
            suffix="%"
          />
        </div>

        <Section title="Opacity">
          <div className="grid grid-cols-4 gap-1">
            {[0.05, 0.08, 0.12, 0.2].map((v) => (
              <Btn
                key={v}
                onClick={() => onPatch({ opacity: v })}
                tone={Math.abs(object.opacity - v) < 0.005 ? "on" : "plain"}
              >
                {Math.round(v * 100)}%
              </Btn>
            ))}
          </div>
        </Section>

        <Section title="Size">
          <div className="grid grid-cols-4 gap-1">
            {[120, 210, 300, 420].map((v) => (
              <Btn
                key={v}
                onClick={() => onPatch({ fontSize: v })}
                tone={Math.round(object.fontSize) === v ? "on" : "plain"}
              >
                {v}
              </Btn>
            ))}
          </div>
        </Section>

        <Btn
          onClick={() =>
            onPatch({
              fontSize: ZONE_MARK.fontSize,
              opacity: ZONE_MARK.opacity,
              rotation: ZONE_MARK.rotation,
            })
          }
        >
          Back to the house treatment
        </Btn>

        {order}
        {footer}
      </div>
    );
  }

  if (object.kind === "arrow") {
    const len = Math.hypot(object.x2 - object.x1, object.y2 - object.y1);
    const ang = ((Math.round((Math.atan2(object.y2 - object.y1, object.x2 - object.x1) * 180) / Math.PI) % 360) + 360) % 360;
    const setPolar = (length: number, deg: number) => {
      const r = (deg * Math.PI) / 180;
      onPatch({ x2: object.x1 + Math.cos(r) * length, y2: object.y1 + Math.sin(r) * length });
    };
    return (
      <div className="space-y-3.5">
        {header}
        <p className="text-[0.5625rem] uppercase tracking-[0.16em] text-neutral-500">Strelica</p>
        <div className="space-y-1">
          <Num label="X" value={object.x1} onChange={(v) => onPatch({ x2: object.x2 + (v - object.x1), x1: v })} />
          <Num label="Y" value={object.y1} onChange={(v) => onPatch({ y2: object.y2 + (v - object.y1), y1: v })} />
          <Num label="Length" value={len} onChange={(v) => setPolar(Math.max(6, v), ang)} />
          <Num label="Angle" value={ang} onChange={(v) => setPolar(len, v)} />
          <Num label="Stroke" value={object.width} onChange={(v) => onPatch({ width: Math.max(0.5, v) })} />
          <Num label="Head" value={object.head} onChange={(v) => onPatch({ head: Math.max(2, v) })} />
        </div>
        <Section title="Flip">
          <Btn
            onClick={() =>
              onPatch({ x1: object.x2, y1: object.y2, x2: object.x1, y2: object.y1 })
            }
          >
            Reverse direction
          </Btn>
        </Section>
        {order}
        {footer}
      </div>
    );
  }

  return (
    <div className="space-y-3.5">
      {header}
      <p className="text-[0.5625rem] uppercase tracking-[0.16em] text-neutral-500">
        {object.kind === "structure" ? object.skind : "Passage"}
      </p>
      <div className="space-y-1">
        <Num label="X" value={object.x} onChange={(x) => onPatch({ x })} />
        <Num label="Y" value={object.y} onChange={(y) => onPatch({ y })} />
        <Num label="W" value={object.w} onChange={(w) => onPatch({ w: Math.max(4, w) })} />
        <Num label="H" value={object.h} onChange={(h) => onPatch({ h: Math.max(4, h) })} />
      </div>
      {order}
      {footer}
    </div>
  );
}
