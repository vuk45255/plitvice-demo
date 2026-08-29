"use client";

import { useLang } from "@/components/providers/language";
import { INK } from "@/components/floor-plan/plan-ink";
import {
  PlanArchitecture,
  type Architecture,
  type PlanInk,
} from "@/components/floor-plan/plan-shapes";
import { SHOW_REFERENCE_OVERLAY } from "@/lib/floor-plan";

/* The room itself, in the guest's colours.
 *
 * THE DRAWING MOVED, THE PALETTE DID NOT. Every wall, tread, arc and sign is
 * drawn by `PlanArchitecture` in components/floor-plan/plan-shapes.tsx, which
 * the office's map calls as well — one implementation of the building, so a
 * wall that moves moves on both. What stays here is what is genuinely the
 * guest's: this palette, and the fact that a sign the club has not written out
 * on the plan is TRANSLATED. The office does not translate anything, which is
 * exactly why the words are asked for rather than looked up inside. */

export type { Architecture };

/* The plan's own ink, restated in the shape the shared drawing takes. */
const GUEST_INK: PlanInk = {
  ground: INK.ground,
  floor: INK.floor,
  floorEdge: INK.floorEdge,
  structure: INK.structure,
  structureEdge: INK.structureEdge,
  tread: INK.tread,
  label: INK.label,
  labelArea: INK.labelArea,
  zoneMark: INK.zoneMark,
};

export function FloorPlanArchitecture({
  architecture,
  showReference = SHOW_REFERENCE_OVERLAY,
}: {
  architecture?: Architecture;
  showReference?: boolean;
} = {}) {
  const { t } = useLang();

  return (
    <PlanArchitecture
      ink={GUEST_INK}
      /* A label with its own text is the room's own signage and is set as
         written — including where that text is deliberately empty. Everything
         else is translated. */
      labelText={(label) => label.text ?? t(label.key)}
      architecture={architecture}
      showReference={showReference}
    />
  );
}
