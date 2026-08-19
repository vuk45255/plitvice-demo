"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FloorPlanArchitecture,
  type Architecture,
} from "@/components/floor-plan/floor-plan-architecture";
import { FloorPlanBooth } from "@/components/floor-plan/floor-plan-booth";
import { FloorPlanControls } from "@/components/floor-plan/floor-plan-controls";
import { FloorPlanTable } from "@/components/floor-plan/floor-plan-table";
import { ID_VISIBLE_AT, INK } from "@/components/floor-plan/plan-ink";
import { useSeatCopy } from "@/components/floor-plan/use-seat-copy";
import { useReducedMotion } from "framer-motion";
import { useLang } from "@/components/providers/language";
import {
  PLAN,
  REFERENCE_IMAGE,
  REFERENCE_OPACITY,
  SHOW_REFERENCE_OVERLAY,
} from "@/lib/floor-plan";
import type { Seat } from "@/lib/floor-availability";

/* The map itself: the room, the tables on it, and the ability to get closer.
 *
 * The drawing is one SVG at a fixed plan size, laid into whatever space the
 * screen gives it. Everything that moves is a single transform on a single
 * group — no layout is recalculated while the guest drags, so a floor of a
 * hundred-odd tables pans at the refresh rate on a phone.
 *
 * One vocabulary, three ways in: wheel or the controls on a desk, drag and
 * pinch on a phone, arrow keys and tab for anyone on a keyboard. Panning is
 * clamped, so the room can be moved but never thrown off the screen and lost.
 *
 * The map holds no opinion about what a table is or whether it is free. It is
 * handed `seats` already resolved — see lib/floor-availability.ts — and hands
 * back whichever one was touched. */

const FIT = 1;
const MAX_SCALE = 6;
const STEP = 1.55;

/* A phone cannot show the whole club and still show a table worth tapping, so
   it opens part-way in, over the first two halls, where the stage is and where
   the room reads from. The frame control gets the guest back out to all of it. */
const PHONE_OPEN = { scale: 2.1, at: { x: 600, y: 340 } };

/* Where the camera settles when a table is touched.
 *
 * FOCUS, NOT INSPECT. The guest has just asked about one table; what they need
 * is that table and the part of the club it stands in — the tables either side
 * of it, the wall it is against, enough of the zone to know where they would
 * be sitting. Going closer than this answers a question nobody asked and loses
 * the only thing the map is for. So the move is deliberately modest, and it
 * never zooms *out*: a guest already close in keeps their magnification and
 * simply glides across to the table they touched. */
const FOCUS_SCALE = 1.6;
const FOCUS_SCALE_PHONE = 2.6;

/* The card is over the map, not beside it, so the middle of the screen is not
   the middle of what the guest can see. On a desk the panel holds the left —
   21.5rem wide in a 2rem gutter — and the table is centred in what is left of
   the room. On a phone the sheet comes up the bottom, so the table is set high
   in the frame instead, well clear of it. Stated from the panel's own CSS
   rather than measured: the camera starts moving in the same frame the card is
   asked for, before the card has been laid out to measure. */
const PANEL_SPAN = 344 + 32 * 2;
const PHONE_FOCUS_Y = 0.34;

/* Long enough to read as a move rather than a cut, short enough that it never
   stands between the guest and the table they just asked about. */
const GLIDE_MS = 460;

/* Ease in, ease out, no overshoot — a camera on rails rather than a spring. */
const glideEase = (p: number) =>
  p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;

type View = { scale: number; x: number; y: number };

const AT_FIT: View = { scale: FIT, x: 0, y: 0 };

/* The window always shows viewBox 0..W, 0..H; keep the drawing covering it. */
function clampView(view: View): View {
  return {
    scale: view.scale,
    x: Math.min(0, Math.max(PLAN.width * (1 - view.scale), view.x)),
    y: Math.min(0, Math.max(PLAN.height * (1 - view.scale), view.y)),
  };
}

/* Zoom about a fixed point given in viewBox units — under the cursor, under
   the pinch, or the middle of the screen when it came from a control. */
function zoomAbout(view: View, nextScale: number, px: number, py: number): View {
  const scale = Math.min(MAX_SCALE, Math.max(FIT, nextScale));
  return clampView({
    scale,
    x: px - ((px - view.x) * scale) / view.scale,
    y: py - ((py - view.y) * scale) / view.scale,
  });
}

export function FloorPlan({
  seats,
  selectedId,
  onSelect,
  onHoverChange,
  architecture,
}: {
  seats: Seat[];
  selectedId?: string;
  onSelect: (seat: Seat) => void;
  onHoverChange: (
    seat: Seat | null,
    at?: { clientX: number; clientY: number },
  ) => void;
  /* Only the editor passes this, so its PREVIEW shows the walls being edited
     rather than the ones on disk. */
  architecture?: Architecture;
}) {
  const { t } = useLang();
  const reduced = useReducedMotion();
  const svgRef = useRef<SVGSVGElement>(null);
  /* Where the map opens. A phone opens part-way in; anything wider opens on
     the whole club. Decided once, as the first view rather than as a correction
     to it, so the guest never sees it settle. */
  const [view, setView] = useState<View>(() => {
    if (typeof window === "undefined") return AT_FIT;
    if (window.matchMedia("(min-width: 768px)").matches) return AT_FIT;
    const { scale, at } = PHONE_OPEN;
    return clampView({
      scale,
      x: PLAN.width / 2 - at.x * scale,
      y: PLAN.height / 2 - at.y * scale,
    });
  });
  const [hoveredId, setHoveredId] = useState<string>();
  const { ariaLabel } = useSeatCopy();

  /* A desk has room for every table's number at once; a phone does not, and
     showing them all there would bury the room under type. So a phone gets
     them as it zooms in, and — whatever the magnification — on the table
     under the finger or the one that has been chosen. Read once, alongside the
     opening view above, rather than watched. */
  const [wide] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches,
  );

  /* Live pointers, by id — one is a drag, two are a pinch. Pointer capture is
     deliberately not used: it would move the click target off the table that
     was actually pressed, and a tap on a table is the whole point of this. */
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ distance: number; scale: number } | null>(null);
  /* A drag must not also register as a tap on whatever it began over. */
  const moved = useRef(false);

  /* Client coordinates → viewBox units. The browser owns the letterboxing
     `preserveAspectRatio` does, so we ask it rather than recompute it. */
  const toViewBox = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return { x: 0, y: 0 };
    const point = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    return { x: point.x, y: point.y };
  }, []);

  /* The camera, moved rather than cut.
   *
   * ONE TRANSFORM, ANIMATED. There is no second view and no second set of
   * coordinates: this walks the same { scale, x, y } the drag, the pinch and
   * the wheel work on, frame by frame, and every frame is clamped exactly as
   * theirs are. Nothing on the plan moves — the window over it does.
   *
   * The guest is always in charge of it. Any touch, wheel, key or control
   * stops the glide where it stands, because a camera that keeps travelling
   * under somebody's finger is a camera fighting them. */
  const glide = useRef<number | null>(null);
  /* Where the camera stands right now, kept beside the state so a glide can
     read its own starting point without being re-created every time the guest
     nudges the map. */
  const viewNow = useRef(view);
  useEffect(() => {
    viewNow.current = view;
  }, [view]);

  const stopGlide = useCallback(() => {
    if (glide.current !== null) {
      cancelAnimationFrame(glide.current);
      glide.current = null;
    }
  }, []);

  const glideTo = useCallback(
    (to: View) => {
      stopGlide();
      const from = viewNow.current;
      if (reduced) {
        setView(clampView(to));
        return;
      }
      const started = performance.now();
      const step = (now: number) => {
        const p = Math.min(1, (now - started) / GLIDE_MS);
        const e = glideEase(p);
        setView(
          clampView({
            scale: from.scale + (to.scale - from.scale) * e,
            x: from.x + (to.x - from.x) * e,
            y: from.y + (to.y - from.y) * e,
          }),
        );
        glide.current = p < 1 ? requestAnimationFrame(step) : null;
      };
      glide.current = requestAnimationFrame(step);
    },
    [reduced, stopGlide],
  );

  useEffect(() => stopGlide, [stopGlide]);

  const zoomBy = useCallback(
    (factor: number) => {
      stopGlide();
      setView((v) => zoomAbout(v, v.scale * factor, PLAN.width / 2, PLAN.height / 2));
    },
    [stopGlide],
  );

  /* The frame control is its own move, and the only one that goes back out to
     the whole club. Closing a table's card is not this. */
  const reset = useCallback(() => glideTo(AT_FIT), [glideTo]);

  /* Bring the chosen table into the part of the map the guest can actually
     see, and hold whatever magnification they are already at if it is closer
     than the focus itself. Runs once per new selection: never on the way back
     out of a card, and never again while they pan around afterwards. */
  const focused = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!selectedId) {
      /* Dismissing a card leaves the camera exactly where it is; the next
         table chosen is a fresh move, so the memory is cleared here. */
      focused.current = undefined;
      return;
    }
    if (selectedId === focused.current) return;
    focused.current = selectedId;

    const seat = seats.find((s) => s.id === selectedId);
    const svg = svgRef.current;
    if (!seat || !svg) return;

    const box = svg.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) return;

    /* Where on the screen the table should end up: middle of the room left
       over beside the panel on a desk, high in the frame above the sheet on a
       phone. Turned into viewBox units by the browser's own matrix, so the
       letterboxing is accounted for rather than guessed at. */
    const room = Math.max(box.width - PANEL_SPAN, box.width * 0.45);
    const at = wide
      ? { x: box.right - room / 2, y: box.top + box.height / 2 }
      : { x: box.left + box.width / 2, y: box.top + box.height * PHONE_FOCUS_Y };
    const target = toViewBox(at.x, at.y);

    const scale = Math.min(
      MAX_SCALE,
      Math.max(viewNow.current.scale, wide ? FOCUS_SCALE : FOCUS_SCALE_PHONE),
    );

    glideTo({
      scale,
      x: target.x - seat.x * scale,
      y: target.y - seat.y * scale,
    });
  }, [glideTo, seats, selectedId, toViewBox, wide]);

  /* Wheel must be non-passive to be preventable, which rules out onWheel. */
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      stopGlide();
      const at = toViewBox(e.clientX, e.clientY);
      setView((v) => zoomAbout(v, v.scale * Math.exp(-e.deltaY * 0.0016), at.x, at.y));
    };

    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, [stopGlide, toViewBox]);

  /* A release anywhere ends the gesture — including one that finished outside
     the drawing, which without this would leave a phantom finger down. */
  useEffect(() => {
    const drop = (e: PointerEvent) => {
      pointers.current.delete(e.pointerId);
      if (pointers.current.size < 2) pinch.current = null;
    };
    window.addEventListener("pointerup", drop);
    window.addEventListener("pointercancel", drop);
    return () => {
      window.removeEventListener("pointerup", drop);
      window.removeEventListener("pointercancel", drop);
    };
  }, []);

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    /* A hand on the map takes the camera off the rails at once — including a
       hand that has landed on a table, because the tap that follows may be a
       drag and the glide must not be dragging with it. */
    stopGlide();
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved.current = false;
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { distance: Math.hypot(a.x - b.x, a.y - b.y), scale: view.scale };
    }
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const previous = pointers.current.get(e.pointerId);
    if (!previous) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size >= 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch.current.distance > 0) {
        const at = toViewBox((a.x + b.x) / 2, (a.y + b.y) / 2);
        const next = (pinch.current.scale * distance) / pinch.current.distance;
        moved.current = true;
        setView((v) => zoomAbout(v, next, at.x, at.y));
      }
      return;
    }

    if (Math.abs(e.clientX - previous.x) + Math.abs(e.clientY - previous.y) > 3) {
      moved.current = true;
    }

    const from = toViewBox(previous.x, previous.y);
    const to = toViewBox(e.clientX, e.clientY);
    setView((v) => clampView({ ...v, x: v.x + (to.x - from.x), y: v.y + (to.y - from.y) }));
  };

  const endPointer = (e: React.PointerEvent<SVGSVGElement>) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  };

  /* Arrow keys walk the room for anyone not holding a pointer. */
  const onKeyDown = (e: React.KeyboardEvent<SVGSVGElement>) => {
    stopGlide();
    const step = 90 / view.scale;
    const nudge: Record<string, [number, number]> = {
      ArrowUp: [0, step],
      ArrowDown: [0, -step],
      ArrowLeft: [step, 0],
      ArrowRight: [-step, 0],
    };
    const move = nudge[e.key];
    if (move) {
      e.preventDefault();
      setView((v) => clampView({ ...v, x: v.x + move[0], y: v.y + move[1] }));
      return;
    }
    if (e.key === "+" || e.key === "=") {
      e.preventDefault();
      zoomBy(STEP);
    } else if (e.key === "-") {
      e.preventDefault();
      zoomBy(1 / STEP);
    }
  };

  const hover = useCallback(
    (seat: Seat | null, at?: { clientX: number; clientY: number }) => {
      setHoveredId(seat?.id);
      onHoverChange(seat, at);
    },
    [onHoverChange],
  );

  const select = useCallback(
    (seat: Seat) => {
      if (moved.current) return;
      onSelect(seat);
    },
    [onSelect],
  );

  const showIds = wide || view.scale >= ID_VISIBLE_AT;

  /* Booths go down first, so a bar table standing against one is never buried
     underneath it. */
  const ordered = useMemo(() => {
    const rank = (seat: Seat) => (seat.type === "booth" ? 0 : 1);
    return [...seats].sort((a, b) => rank(a) - rank(b));
  }, [seats]);

  return (
    <div className="relative h-full w-full">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${PLAN.width} ${PLAN.height}`}
        preserveAspectRatio="xMidYMid meet"
        className="h-full w-full"
        style={{ touchAction: "none", cursor: "grab" }}
        role="application"
        aria-label={t("floor.title")}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onPointerLeave={(e) => {
          endPointer(e);
          hover(null);
        }}
      >
        <defs>
          {/* the club's own light: low, warm and well behind the room */}
          <radialGradient id="plan-glow" cx="50%" cy="42%" r="62%">
            <stop offset="0%" stopColor="#2a123f" stopOpacity="0.85" />
            <stop offset="60%" stopColor="#120a1f" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#08050d" stopOpacity="0" />
          </radialGradient>

          {/* The light around the chosen table. It is a real blur rather than
              a second outline, and it is only ever on one element at a time,
              so it costs nothing to leave switched on.
              One pass of the blur, not two: the doubled version read as a lamp
              switched on under the table rather than as candlelight on it, and
              the club is lit low. */}
          <filter id="seat-glow" x="-150%" y="-150%" width="400%" height="400%">
            <feGaussianBlur stdDeviation="4.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <rect width={PLAN.width} height={PLAN.height} fill={INK.ground} />
        <rect width={PLAN.width} height={PLAN.height} fill="url(#plan-glow)" />

        <g transform={`translate(${view.x} ${view.y}) scale(${view.scale})`}>
          {/* DEVELOPMENT ONLY — see SHOW_REFERENCE_OVERLAY in lib/floor-plan.ts.
              Laid at exactly the viewBox bounds and inside the same transform
              as the trace, so it pans and zooms with it and any drift between
              the two is visible at any magnification. */}
          {SHOW_REFERENCE_OVERLAY ? (
            <image
              href={REFERENCE_IMAGE}
              x={0}
              y={0}
              width={PLAN.width}
              height={PLAN.height}
              opacity={REFERENCE_OPACITY}
              preserveAspectRatio="none"
              pointerEvents="none"
            />
          ) : null}

          <FloorPlanArchitecture architecture={architecture} />

          {ordered.map((seat) => {
            const shared = {
              seat,
              picked: seat.id === selectedId,
              hovered: seat.id === hoveredId,
              showId: showIds,
              label: ariaLabel(seat),
              onSelect: select,
              onHover: hover,
            };
            return seat.type === "booth" ? (
              <FloorPlanBooth key={seat.id} {...shared} />
            ) : (
              <FloorPlanTable key={seat.id} {...shared} />
            );
          })}
        </g>
      </svg>

      <div className="pointer-events-auto absolute right-5 top-5 md:right-7 md:top-7">
        <FloorPlanControls
          onZoomIn={() => zoomBy(STEP)}
          onZoomOut={() => zoomBy(1 / STEP)}
          onReset={reset}
          canZoomIn={view.scale < MAX_SCALE - 0.01}
          canZoomOut={view.scale > FIT + 0.01}
        />
      </div>
    </div>
  );
}
