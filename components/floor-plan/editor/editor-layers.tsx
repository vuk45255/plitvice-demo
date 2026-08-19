"use client";

import { useState } from "react";
import type { EditorDoc, EditorObject } from "@/components/floor-plan/editor/editor-doc";

/* Everything on the plan, grouped the way the club talks about it.
 *
 * Collapsed by default and kept narrow, because this is a way of reaching the
 * one object you cannot click — the locked one, the hidden one, the one buried
 * under something else — rather than a thing to read. Each zone can be shut
 * down whole, which is what you want the moment a part of the club is traced
 * and you would rather not nudge it again. */

const GROUPS = [
  { key: "1", title: "Zone 1" },
  { key: "2", title: "Zone 2" },
  { key: "3", title: "Zone 3" },
  { key: "4", title: "Galerija" },
  { key: "walls", title: "Walls" },
  { key: "stairs", title: "Stairs · straight" },
  { key: "fans", title: "Stairs · curved" },
  { key: "arrows", title: "Arrows" },
  { key: "labels", title: "Labels" },
  { key: "zonenums", title: "Zone numbers" },
  { key: "arch", title: "Structures" },
] as const;

export type GroupKey = (typeof GROUPS)[number]["key"];

/* Seats are filed by the zone they stand in — that is how the club talks
   about them. Everything else is filed by what it is. */
export function groupOf(o: EditorObject): GroupKey {
  switch (o.kind) {
    case "seat": return String(o.zone) as GroupKey;
    case "wall": return "walls";
    case "stairs": return "stairs";
    case "fan": return "fans";
    case "arrow": return "arrows";
    case "label": return "labels";
    /* Filed on their own rather than with the zone's tables: a numeral is
       furniture for the eye, and hiding a zone's seating should not take the
       thing that names the zone down with it. */
    case "zonemark": return "zonenums";
    default: return "arch";
  }
}

function nameOf(o: EditorObject) {
  if (o.kind === "passage") return "passage";
  if (o.kind === "wall") return o.closed ? o.id : `${o.id} · open`;
  if (o.kind === "label") return o.text ? `${o.id} · ${o.text}` : o.id;
  if (o.kind === "zonemark") return `${o.id} · ${o.zone}`;
  return o.id;
}

export function EditorLayers({
  doc,
  selected,
  onSelect,
  onToggleHidden,
  onToggleLocked,
  onGroupLock,
  onGroupHide,
}: {
  doc: EditorDoc;
  selected: Set<string>;
  onSelect: (uid: string, additive: boolean) => void;
  onToggleHidden: (uid: string) => void;
  onToggleLocked: (uid: string) => void;
  onGroupLock: (key: GroupKey, locked: boolean) => void;
  onGroupHide: (key: GroupKey, hidden: boolean) => void;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({});

  return (
    <div className="text-[0.6875rem]">
      {GROUPS.map((g) => {
        const items = doc.objects.filter((o) => groupOf(o) === g.key);
        if (items.length === 0) return null;
        const isOpen = open[g.key];
        const allLocked = items.every((o) => o.locked);
        const allHidden = items.every((o) => o.hidden);

        return (
          <div key={g.key} className="border-b border-neutral-800/70">
            <div className="flex items-center gap-1 px-1 py-1.5">
              <button
                type="button"
                onClick={() => setOpen((s) => ({ ...s, [g.key]: !s[g.key] }))}
                className="min-w-0 flex-1 text-left uppercase tracking-[0.14em] text-neutral-400 hover:text-neutral-100"
              >
                {isOpen ? "▾" : "▸"} {g.title}
                <span className="ml-1.5 tabular-nums text-neutral-600">{items.length}</span>
              </button>
              <button
                type="button"
                title={allHidden ? "Show zone" : "Hide zone"}
                onClick={() => onGroupHide(g.key, !allHidden)}
                className={`px-1 ${allHidden ? "text-neutral-700" : "text-neutral-400"}`}
              >
                {allHidden ? "○" : "◉"}
              </button>
              <button
                type="button"
                title={allLocked ? "Unlock zone" : "Lock zone"}
                onClick={() => onGroupLock(g.key, !allLocked)}
                className={`px-1 ${allLocked ? "text-amber-400" : "text-neutral-700"}`}
              >
                {allLocked ? "▮" : "▯"}
              </button>
            </div>

            {isOpen ? (
              <ul className="max-h-48 overflow-y-auto pb-1.5">
                {items.map((o) => {
                  const on = selected.has(o.uid);
                  return (
                    <li key={o.uid}>
                      <div
                        className={`flex items-center gap-1 px-1 py-0.5 ${
                          on ? "bg-amber-500/15 text-amber-300" : "text-neutral-400"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={(e) => onSelect(o.uid, e.shiftKey)}
                          className="min-w-0 flex-1 truncate text-left font-mono hover:text-neutral-100"
                        >
                          {nameOf(o)}
                        </button>
                        <button type="button" title={o.hidden ? "Show" : "Hide"} onClick={() => onToggleHidden(o.uid)} className="px-0.5">
                          <span className={o.hidden ? "text-neutral-700" : "text-neutral-500"}>
                            {o.hidden ? "○" : "◉"}
                          </span>
                        </button>
                        <button
                          type="button"
                          title={o.locked ? "Unlock" : "Lock"}
                          onClick={() => onToggleLocked(o.uid)}
                          className={`px-0.5 ${o.locked ? "text-amber-400" : "text-neutral-700"}`}
                        >
                          {o.locked ? "▮" : "▯"}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
