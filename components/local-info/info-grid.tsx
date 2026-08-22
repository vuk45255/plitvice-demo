"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  motion,
  useMotionValue,
  useScroll,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { Arrow } from "@/components/arrow";
import { InfoPhoto } from "@/components/local-info/info-photo";
import { useLang } from "@/components/providers/language";
import { INFO, type InfoCategory } from "@/lib/local-info";

/* The six, as pictures — and a pressure wave travelling down them.
 *
 * THERE IS NO ROW INDEX IN THIS FILE. Three columns on a desktop and two on a
 * phone are the only thing the layout says; everything else is worked out by
 * measuring where the browser actually put the cards. Cards sharing a top edge
 * are a row, at every width and any column count this grid is ever given.
 *
 * ─── HOW A ROW COMES FORWARD AS ONE OBJECT ───────────────────────────────
 *
 * The grid is a flat list of six cells. There is no element wrapping a row —
 * there cannot be, because a row is two cells on a phone and three on a
 * desktop, and one DOM cannot be both. So the row's transform is reconstructed
 * per card, and the whole trick is WHERE EACH CARD IS PROJECTED FROM.
 *
 * Every cell carries its own `perspective`, and its `perspective-origin` is
 * moved off its own middle and onto THE MIDDLE OF ITS ROW. A perspective
 * projection scales everything about its origin: with P the perspective and z
 * the depth, a point is pushed away from the origin by P / (P - z). Put that
 * origin on the row's centre for every card in the row, hand all of them the
 * same z, and the separate projections compose into exactly one transform —
 * the row growing about its own middle and sliding toward the viewer. The
 * leftmost card moves left as it grows, the rightmost moves right, the middle
 * one only grows. That is a row coming forward as one object, and it is a real
 * 3D translation rather than a scale dressed up as one.
 *
 * Project each card from its own centre instead — which is what a plain
 * `scale()` does — and the cards grow into each other, the gaps close, and it
 * reads as six tiles inflating rather than one row approaching.
 *
 * ─── THE ARITHMETIC IS PER ROW, NOT PER CARD ─────────────────────────────
 *
 * A row has one distance from the middle of the screen, so it has one depth,
 * one lift, one grade, one shadow and one stacking order — and there are only
 * ever two or three rows. All of it is therefore computed once per row and
 * handed to the cards on it, which SHARE the motion values rather than each
 * deriving its own copy. Half the per-frame arithmetic of the obvious version,
 * and the cards on a row are now driven by literally the same objects, so they
 * cannot come apart even in principle.
 *
 * The grid never has fewer than two columns, so six cards are never more than
 * three rows — which is why exactly three sets of values are prepared below.
 *
 * ─── AND WHY NONE OF IT COSTS A FRAME ────────────────────────────────────
 *
 * Measurements are taken on mount and on resize, never on scroll. What the
 * scroll drives is arithmetic over numbers already in hand: no frame reads
 * layout, and no frame sets React state. Nothing is sprung and nothing is
 * eased — the whole thing is a pure function of scroll position, which is what
 * makes it track a finger exactly and stop dead when the finger does. */

/* The perspective every cell is seen through. Shallow enough that a real depth
   reads as an approach, deep enough that nothing skews. */
const PERSPECTIVE = 1200;

/* What a row does at the middle of the screen, by how much room it has.
 *
 * Read `push` as the scale it produces — P / (P - push) — rather than as a
 * distance: 88 is 1.079 and 54 is 1.047. A phone gets much the stronger of the
 * two. Its rows are wide relative to the screen and it is held at arm's
 * length, and what reads as a clear lift on a desktop barely registers there.
 *
 * `shade` is how much of the shadow the row is allowed at full strength — the
 * desktop keeps a little back, where the rows are smaller and further apart
 * and the same shadow would read as heavy. */
type Tuning = { push: number; lift: number; shade: number };

const NARROW: Tuning = { push: 88, lift: 14, shade: 1 };
const WIDE: Tuning = { push: 54, lift: 10, shade: 0.78 };

/* The width at which the grid becomes a three-up, in step with `md`. */
const WIDE_AT = 768;

/* THE ROOM THE WAVE NEEDS AT THE SIDES OF A PHONE.
 *
 * A row grows about its own middle, so at full strength it is `NARROW_SCALE`
 * times wider than it was — and a grid that starts out exactly as wide as the
 * screen has nowhere to put that. Both outer cards run off the edges, and the
 * label sits closer to the card's edge than the overhang is deep, so the first
 * letter of NON-STOP SHOP goes with them.
 *
 * The fix is spatial, not a weaker wave: hold the grid at the reciprocal of the
 * scale it will reach, and the row arrives at exactly the width of the screen
 * at the moment it is fully forward. The two are derived from the same numbers,
 * so the room can never be the wrong size for the movement — change `push` and
 * the inset follows it. A further half a percent keeps the card edge off the
 * screen edge rather than flush against it, which leaves the horizontal throw
 * of the shadow somewhere to go as well.
 *
 * It comes to about fourteen pixels a side on a phone: enough for the wave,
 * and small enough that the flat state still reads as one wall of pictures
 * rather than a grid with margins. From `md` up none of this applies — the
 * page's own padding is already several times the room a desktop row needs. */
const NARROW_SCALE = PERSPECTIVE / (PERSPECTIVE - NARROW.push);
const ROOM = `${(100 / NARROW_SCALE - 0.6).toFixed(3)}%`;

/* THE ROW LIFTS OFF THE PAGE, so its shadow falls on the row beneath it.
 *
 * TWO CASTS, EACH A FIXED STRING, CROSS-FADED. A shadow that grows has to
 * interpolate its offset, its blur and its alpha together, and rewriting a
 * box-shadow on every frame means re-rasterising a 65px blur on every frame —
 * the one thing on this page that would actually drop a phone below sixty.
 * Two constant shadows solve it: each is rasterised once and never again, and
 * all that moves is opacity, which is free.
 *
 * They are deliberately unequal and come up on different clocks. CONTACT is
 * tight and close and leads, the way the dark seam under a lifting object
 * appears before anything else does; AMBIENT is wide and far and follows. A
 * faint tight seam becomes a deep soft throw with nothing but two fades, and
 * the composite reads as one shadow whose offset and blur are growing.
 *
 * Both are pure black. This page is very nearly black already, and a shadow
 * with any colour in it reads as a glow.
 *
 * The offsets are positive and the blurs are larger than the offsets, so the
 * cast falls DOWNWARD and thins toward the sides — an object above a surface,
 * not a halo around a card. */
const CONTACT = "0 12px 28px rgba(0,0,0,0.5)";
const AMBIENT = "0 30px 65px rgba(0,0,0,0.62)";

/* How the two come up against proximity. Both are powers of it, so both are
   nought at nought, one at one, and smooth the whole way between — the shadow
   can never arrive or leave except by passing through every value in order.
   CONTACT is the shallower power and therefore the earlier riser. */
const CONTACT_CURVE = 1.2;
const AMBIENT_CURVE = 2;

/* How much of the resting grade comes back at the middle of the screen. These
   MULTIPLY the grade the card already wears, so 1.206 takes a brightness of
   0.68 to 0.82 and 1.08 takes a contrast of 1.06 to 1.145. THE ROW DOES NOT
   REGAIN ITS COLOUR HERE — being looked at is not the same as being reached
   for, and only hover, focus and touch take the grey out. */
const CLEARER = 0.206;
const CRISPER = 0.08;

/* The most rows six cards can ever form: the grid never drops below two
   columns, so three is the ceiling, and it is the number of value sets the
   component prepares. */
const MAX_ROWS = 3;

/* How far from the middle of the screen the wave reaches, as a share of the
   screen. Rows overlap inside it — one is always receding as the next
   arrives — which is what makes it read as a wave rather than a spotlight. */
const REACH = 0.58;

/* ─────────────────────── the grid assembling itself ───────────────────────
 *
 * The rows arrive on the handover rather than on an observer, because they
 * arrive INSIDE the pinned scene — while the last question is still leaving
 * it — and an observer has nothing useful to say about an element that is not
 * moving on screen. Scroll position is the only clock here, which also means
 * the assembly runs backwards, exactly, if the visitor scrolls back up into
 * the questions.
 *
 * A row takes ENTER_SPAN of the handover and each one starts ENTER_STEP after
 * the last, so three rows are done by 0.94 and there is a beat of stillness
 * before the pin lets go. */
const ENTER_FROM = 0.22;
const ENTER_SPAN = 0.34;
const ENTER_STEP = 0.2;

/* What a row does on the way in. The rise and the fade are ordinary; the depth
   is the part that makes it read as assembly rather than as a fade — the row
   comes from behind the screen, past its resting plane toward the viewer, and
   settles back onto it. Written as depth rather than as scale so that it goes
   through the cell's perspective and the row therefore grows about the row's
   own middle, exactly as the live wave does. -76 is a scale of 0.94. */
const ENTER_RISE = 70;
const ENTER_BACK = -76;
const ENTER_PROUD = 16;
const ENTER_CREST = 0.62;

export function InfoGrid({
  enter,
  scene,
  still,
  settled,
}: {
  /* The handover, nought to one — see components/sections/local-info.tsx. */
  enter: MotionValue<number>;
  /* The screen-high child the whole scene is pinned inside. */
  scene: React.RefObject<HTMLDivElement | null>;
  still: boolean | null;
  /* True once the story is told and the scene has dropped out of its pin.
     The wave reads the pin`s geometry to know where a row is on screen, and
     that geometry has just changed under it — so this is in the measuring
     effect`s dependencies purely to make it measure again. */
  settled: boolean | null;
}) {
  const { t } = useLang();
  const reduced = still;

  const grid = useRef<HTMLUListElement>(null);

  /* The cells themselves — never transformed, so their boxes are the layout
     and can be measured at any time, including mid-animation. */
  const cells = useRef<(HTMLLIElement | null)[]>([]);

  /* WHERE A ROW IS ON SCREEN IS NO LONGER A DOCUMENT POSITION.
   *
   * The grid lives inside an element that is stuck to the top of the viewport
   * for most of the section, and a stuck element does not move with the page:
   * a row's document coordinate stops predicting where it is on screen the
   * moment the pin takes hold. Measuring one and subtracting the scroll — which
   * is what this did while the grid was ordinary flow content — would have the
   * whole wave sweeping through the grid while the grid sat perfectly still.
   *
   * So a row records its offset INSIDE the pinned scene, which is constant,
   * and where that scene is on screen is worked out from the pin's own
   * geometry: above the track it is falling toward the top, inside the track it
   * is exactly at the top, below the track it is climbing away. Three cases,
   * pure arithmetic, no layout read on any frame. */
  const offsets = useRef<number[]>([]);
  const pin = useRef<{ from: number; to: number } | null>(null);
  const reach = useRef(1);
  const half = useRef(0);

  /* Bumped whenever the numbers above change. A motion transform recomputes
     when any of its inputs move, so listing this alongside the scroll is what
     makes a resize take effect without waiting for the next scroll event. */
  const remeasured = useMotionValue(0);

  /* What the wave is worth at this width. STATE, not a ref, unlike everything
     else here: it is read inside the transforms that turn strength into depth,
     and a ref would leave those closed over the old numbers until the strength
     itself happened to change. It only moves when a breakpoint is crossed. */
  const [tuning, setTuning] = useState<Tuning>(WIDE);

  /* Read at render rather than on a frame, so also state: which row each card
     landed on, and how far that card's projection origin sits from its own
     left edge. */
  const [rows, setRows] = useState<number[]>(() => INFO.map(() => 0));
  const [origins, setOrigins] = useState<(number | null)[]>(() =>
    INFO.map(() => null),
  );

  /* The footprint each row's shadow slab stands on, in the grid's own
     coordinates. Empty until the first measurement, which is why no shadow is
     rendered before then — there is nothing yet for one to be cast by. */
  const [rowBoxes, setRowBoxes] = useState<RowBox[]>([]);

  const { scrollY } = useScroll();

  /* Three rows' worth of values, prepared unconditionally because hooks must
     be. Two-column phones use all three; three-column desktops use the first
     two and leave the last idle, costing nothing — its row has no measured
     middle, so its strength is a constant nought. */
  const seat = {
    scrollY,
    remeasured,
    offsets,
    pin,
    reach,
    half,
    tuning,
    enter,
  };
  const depth0 = useRowDepth(0, seat);
  const depth1 = useRowDepth(1, seat);
  const depth2 = useRowDepth(2, seat);
  const depths = [depth0, depth1, depth2];

  const measure = useCallback(() => {
    const boxes: DOMRect[] = [];
    cells.current.forEach((cell, i) => {
      if (cell) boxes[i] = cell.getBoundingClientRect();
    });
    if (boxes.length === 0) return;

    half.current = window.innerHeight / 2;
    reach.current = Math.max(1, window.innerHeight * REACH);
    setTuning((current) => {
      const next = window.innerWidth >= WIDE_AT ? WIDE : NARROW;
      return current === next ? current : next;
    });

    /* The distinct top edges, in order, are the rows. Rounded, because a grid
       row's tops can differ by a subpixel. */
    const edges: number[] = [];
    boxes.forEach((box) => {
      const top = Math.round(box.top);
      if (!edges.some((edge) => Math.abs(edge - top) < 8)) edges.push(top);
    });
    edges.sort((a, b) => a - b);

    const nextRows = boxes.map((box) =>
      Math.min(
        MAX_ROWS - 1,
        Math.max(
          0,
          edges.findIndex((edge) => Math.abs(edge - Math.round(box.top)) < 8),
        ),
      ),
    );

    /* ONE MIDDLE PER ROW, and the row's outer bounds — which are two things
       at once. They are the point every card on the row has to be projected
       from, written per card as the offset from that card's own left edge
       because that is the form `perspective-origin` wants; and they are the
       footprint the row's shadow slab stands on, written once per row in the
       grid's own coordinates because that is what an absolute box wants. */
    const spans = new Map<
      number,
      { left: number; right: number; top: number; bottom: number }
    >();
    boxes.forEach((box, i) => {
      const row = nextRows[i];
      const span = spans.get(row);
      if (!span)
        spans.set(row, {
          left: box.left,
          right: box.right,
          top: box.top,
          bottom: box.bottom,
        });
      else {
        span.left = Math.min(span.left, box.left);
        span.right = Math.max(span.right, box.right);
        span.top = Math.min(span.top, box.top);
        span.bottom = Math.max(span.bottom, box.bottom);
      }
    });

    const nextOrigins = boxes.map((box, i) => {
      const span = spans.get(nextRows[i]);
      return span ? (span.left + span.right) / 2 - box.left : null;
    });

    /* THE PIN, AND WHERE EACH ROW SITS INSIDE IT. The scene is the element
       that sticks; the track is what it sticks within. `from` is the scroll at
       which it takes hold and `to` the scroll at which it lets go again, and
       between the two the scene's top is the top of the screen. A row's offset
       is measured against the scene rather than the document, so it stays true
       for every one of those three cases. */
    const sceneEl = scene.current;
    const sceneBox = sceneEl?.getBoundingClientRect();
    const trackBox = sceneEl?.parentElement?.getBoundingClientRect();

    if (sceneBox && trackBox) {
      const trackTop = trackBox.top + window.scrollY;
      pin.current = {
        from: trackTop,
        to: trackTop + trackBox.height - window.innerHeight,
      };
      offsets.current = [];
      spans.forEach((span, row) => {
        offsets.current[row] = (span.top + span.bottom) / 2 - sceneBox.top;
      });
    } else {
      pin.current = null;
    }

    const frame = grid.current?.getBoundingClientRect();
    const nextBoxes: RowBox[] = [];
    if (frame) {
      spans.forEach((span, row) => {
        nextBoxes[row] = {
          left: span.left - frame.left,
          top: span.top - frame.top,
          width: span.right - span.left,
          height: span.bottom - span.top,
        };
      });
    }

    setRows((current) => (same(current, nextRows) ? current : nextRows));
    setOrigins((current) =>
      same(current, nextOrigins) ? current : nextOrigins,
    );
    setRowBoxes((current) =>
      sameBoxes(current, nextBoxes) ? current : nextBoxes,
    );
    remeasured.set(remeasured.get() + 1);
  }, [remeasured, scene]);

  /* The grid sits six screens below the fold, so there is nothing to be
     gained by measuring before paint — and useLayoutEffect would only warn
     its way through the server render to get there. */
  useEffect(() => {
    if (reduced) return;
    const node = grid.current;
    if (!node) return;

    /* THE FIRST MEASUREMENT IS TAKEN ON A MICROTASK, and deliberately not on
       an animation frame or on a ResizeObserver's opening callback. Both of
       those are delivered as part of the browser's rendering steps, and a page
       that is sitting still is entitled not to run any: leave the first
       measurement to a frame and on a quiet page it can simply never happen,
       which leaves the rows with no measured footprint and the shadows with
       nothing to be cast by. A microtask runs regardless, and by then layout
       is available for the asking.

       The observer then keeps it honest for everything that changes the grid's
       shape afterwards — a late font, a scrollbar arriving, the breakpoint
       reflowing three columns into two — and the window listener covers the
       other half of the measurement, since half a viewport and the wave's
       reach are read off the window's HEIGHT, which can change without the
       grid changing shape at all. */
    queueMicrotask(measure);

    const observer = new ResizeObserver(measure);
    observer.observe(node);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure, reduced, settled]);

  return (
    /* ALL BUT EDGE TO EDGE ON A PHONE, and inside the page's own measure from
       `md` up. The six are meant to read as one wall of pictures on a small
       screen, so the grid deliberately does not sit in the container the rest
       of the page uses — it takes very nearly the whole width and leaves a
       two-pixel seam between the tiles. What it holds back is ROOM, and only
       room: exactly the width the strongest row will grow by, so a row at the
       middle of the screen finishes flush with the edges instead of past them.
       See ROOM above.

       From `md` the padding and the measure come back and it is an ordinary
       editorial three-up again. The padding steps match .container-x exactly,
       so the grid still lines up with the rail above it, and the page's own
       margins are already several times the room a desktop row asks for.

       Nothing here changes width and nothing here is in flow, so a row coming
       forward cannot produce a scrollbar or move anything on the page. The
       section around this still clips (see components/sections/local-info.tsx),
       but by the time it does the row is inside the screen and only the outer
       falloff of its shadow is reaching the edge. */
    <div className="mx-auto w-full max-w-[1440px] md:px-12 xl:px-20">
      {/* The grid's own frame, so the shadow slabs have something to be
          absolute against. It carries the measure the list used to, and the
          list simply fills it — same box, same width at every breakpoint. */}
      <div
        style={{ "--room": ROOM } as React.CSSProperties}
        className="relative mx-auto w-[var(--room)] md:w-full md:max-w-[1240px]"
      >
        {/* Cast first, in a layer above every card. Nothing here is in flow
            and nothing here takes a pointer. */}
        {!reduced &&
          rowBoxes.map((box, row) =>
            box ? <ShadowCast key={row} box={box} depth={depths[row]} /> : null,
          )}

        <ul
          ref={grid}
          className="grid w-full grid-cols-2 gap-[2px] md:grid-cols-3 md:gap-2"
        >
          {INFO.map((category, i) => {
            const depth = depths[rows[i]] ?? depths[0];

            return (
              <motion.li
                key={category.id}
                ref={(node: HTMLLIElement | null) => {
                  cells.current[i] = node;
                }}
                /* The cell is the camera, and it is pointed at the middle of the
                 row rather than at the middle of itself. Until the first
                 measurement it points at its own middle, where the wave is
                 nought anyway and the difference cannot show.

                 THE RAISED ROW HAS TO PAINT OVER ITS NEIGHBOURS, or the thing
                 it is casting a shadow onto covers the shadow — and a row that
                 has come forward would be occluded by one that has not, which
                 is precisely backwards. The order is quantised to five steps so
                 it changes about four times across a pass rather than on every
                 frame: stacking order is discrete, and nothing is gained by
                 rewriting it sixty times a second. */
                style={
                  reduced
                    ? undefined
                    : {
                        perspective: `${PERSPECTIVE}px`,
                        perspectiveOrigin:
                          origins[i] === null
                            ? "50% 50%"
                            : `${origins[i]}px 50%`,
                        zIndex: depth.layer,
                      }
                }
              >
                <Wave depth={depth} still={reduced}>
                  <Card
                    category={category}
                    label={t(category.name)}
                    alt={t(category.alt)}
                  />
                </Wave>
              </motion.li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

type RowBox = { left: number; top: number; width: number; height: number };

function same(a: (number | null)[], b: (number | null)[]) {
  return a.length === b.length && a.every((value, i) => value === b[i]);
}

function sameBoxes(a: RowBox[], b: RowBox[]) {
  return (
    a.length === b.length &&
    a.every(
      (box, i) =>
        box &&
        b[i] &&
        box.left === b[i].left &&
        box.top === b[i].top &&
        box.width === b[i].width &&
        box.height === b[i].height,
    )
  );
}

/* ─────────────────────────────── the wave ─────────────────────────────── */

type Depth = ReturnType<typeof useRowDepth>;

type Seat = {
  scrollY: MotionValue<number>;
  remeasured: MotionValue<number>;
  offsets: React.RefObject<number[]>;
  pin: React.RefObject<{ from: number; to: number } | null>;
  reach: React.RefObject<number>;
  half: React.RefObject<number>;
  tuning: Tuning;
  enter: MotionValue<number>;
};

/* A cubic ease-out, and the window one row occupies inside the handover. The
   ease has no overshoot in it, so nothing springs and nothing bounces — a row
   simply arrives quickly and lands slowly. */
function landed(t: number) {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return 1 - Math.pow(1 - t, 3);
}

function useRowDepth(row: number, seat: Seat) {
  const { scrollY, remeasured, offsets, pin, reach, half, tuning, enter } =
    seat;
  /* HOW HARD THE MIDDLE OF THE SCREEN IS PRESSING ON THIS ROW — nought at the
     edge of the wave's reach and beyond, one dead centre, continuous
     everywhere between. There is no threshold in it and no state to be in:
     every scroll position has an answer, and scrolling back up gives the same
     answers in reverse.
   *
   * A raised cosine, SQUARED. The cosine alone is the smooth part: it reaches
   * nought with nought SLOPE, where a triangle or a clamped parabola both
   * arrive at their limit still moving and stop dead — a corner that shows as
   * a tick the moment a row settles. Squaring it is the part that gives the
   * middle of the screen its bite. A row half a reach out drops from a half to
   * a quarter of full strength, so the outer rows lie much flatter and almost
   * all of the movement is spent in the last stretch into the centre. That is
   * what makes the middle read as a pressure point rather than a slope. */
  const near = useTransform([scrollY, remeasured], ([y]: number[]) => {
    const offset = offsets.current[row];
    const held = pin.current;
    /* A row that does not exist at this width, or nothing measured yet. */
    if (offset === undefined || !held) return 0;

    /* Where the top of the pinned scene is on screen, in its three cases. */
    const sceneTop =
      y <= held.from ? held.from - y : y >= held.to ? held.to - y : 0;

    const away = (sceneTop + offset - half.current) / reach.current;
    if (away <= -1 || away >= 1) return 0;
    return 0.5 * (1 + Math.cos(Math.PI * away));
  });

  const strength = useTransform(near, (n) => n * n);

  /* ─── the row arriving ───
   *
   * One value, nought to one, for this row's own slice of the handover. Every
   * part of the entrance is a function of it, which is what keeps the two or
   * three cards on a row arriving as one object rather than as tiles. */
  const arriving = useTransform(enter, (e) =>
    landed((e - (ENTER_FROM + row * ENTER_STEP)) / ENTER_SPAN),
  );

  /* Opacity leads the movement — the row is up before it has finished
     settling, so what is watched is a row landing rather than one appearing. */
  const entered = useTransform(enter, (e) =>
    landed((e - (ENTER_FROM + row * ENTER_STEP)) / (ENTER_SPAN * 0.55)),
  );

  /* Depth and rise, both of the entrance and of the live wave, summed into the
     one transform the cell carries. They are the same two properties and there
     is no sense in giving them separate elements to fight over: the entrance
     is simply where the row is coming FROM, and the wave is where the middle
     of the screen is pulling it TO. */
  const z = useTransform([strength, arriving], ([s, a]: number[]) => {
    const from =
      a < ENTER_CREST
        ? ENTER_BACK + (ENTER_PROUD - ENTER_BACK) * (a / ENTER_CREST)
        : ENTER_PROUD * (1 - (a - ENTER_CREST) / (1 - ENTER_CREST));
    return tuning.push * s + from;
  });

  const y = useTransform(
    [strength, arriving],
    ([s, a]: number[]) => -tuning.lift * s + ENTER_RISE * (1 - a),
  );

  /* The picture clearing as the row approaches.
   *
   * This grade is a SEPARATE, UNTRANSITIONED layer above the card's own. The
   * card's filter carries the greyscale and a 620ms ease for the colour that
   * hover brings back; drive a scroll value through that same property and the
   * ease applies to it too, and the brightness arrives two-thirds of a second
   * after the scroll that asked for it — exactly the lag that would make this
   * feel like an animation being played rather than a wave being pushed.
   * Nested filters multiply, so the two compose without either knowing about
   * the other, and this one answers the scroll on the same frame. */
  const grade = useTransform(
    strength,
    (s) =>
      `brightness(${(1 + CLEARER * s).toFixed(3)}) contrast(${(1 + CRISPER * s).toFixed(3)})`,
  );

  /* ─── and the ground it lifts off ───
   *
   * The shadow is cast by a slab standing where the whole row stands, in a
   * layer of its own above every card (see ShadowCast). To sit on the row it
   * has to be carried by the row's movement, and the row's movement is a
   * perspective projection rather than a scale — so the factor is worked out
   * here rather than borrowed. P / (P - z) is what that projection does to
   * anything at depth z, and the lift is multiplied through it because the
   * lift happens in the 3D space, before the projection. */
  const grow = useTransform(z, (depth) => PERSPECTIVE / (PERSPECTIVE - depth));
  const shadowY = useTransform([y, grow], ([rise, k]: number[]) => rise * k);

  /* The two casts, on their own curves — see CONTACT and AMBIENT. Both are
     read off proximity rather than off its square, so the shadow follows the
     row's approach rather than the sharper curve the depth is given: it should
     be showing well before the row snaps forward, not arriving with it.
   *
   * And both are held back by the row's own arrival, so nothing casts a shadow
   * before there is anything there to cast it. */
  const contact = useTransform(
    [near, entered],
    ([n, a]: number[]) => Math.pow(n, CONTACT_CURVE) * tuning.shade * a,
  );
  const ambient = useTransform(
    [near, entered],
    ([n, a]: number[]) => Math.pow(n, AMBIENT_CURVE) * tuning.shade * a,
  );

  /* Quantised: see the note on the cell. */
  const layer = useTransform(strength, (s) => 1 + Math.round(s * 4));

  return { z, y, grade, grow, shadowY, contact, ambient, layer, entered };
}

function Wave({
  depth,
  still,
  children,
}: {
  depth: Depth;
  still: boolean | null;
  children: React.ReactNode;
}) {
  if (still) return <>{children}</>;

  return (
    <motion.div
      style={{ z: depth.z, y: depth.y, opacity: depth.entered }}
      className="will-change-transform"
    >
      <motion.div style={{ filter: depth.grade }}>{children}</motion.div>
    </motion.div>
  );
}

/* ────────────────────────── the shadow a row casts ────────────────────────
 *
 * ONE SLAB PER ROW, AND IT DOES NOT LIVE IN THE ROW.
 *
 * This is where the shadow used to go wrong. It hung inside the cells, behind
 * the card, and a cell's stacking order is driven by how near it is to the
 * middle of the screen. So a row whose shadow should have been falling on the
 * row below it was, for most of its approach, stacked UNDER that row — and its
 * shadow was painted over by an opaque card and simply not there. The moment
 * the two orders crossed, the whole shadow appeared at once. It was not a
 * shadow fading in badly; it was a shadow being uncovered.
 *
 * Worse, the crossing happens at the least forgiving moment available. Two
 * neighbouring rows swap order when they are equidistant from the middle of
 * the screen — half a row apart each — and at that distance both are at about
 * four fifths of full strength. The shadow was not switching on faintly. It
 * was switching on nearly at full.
 *
 * So the casts come out of the cells and into a layer of their own, above
 * every card. Being above them, a shadow can always reach the row it falls on,
 * whatever the cards are doing among themselves — there is no ordering left
 * for it to be hidden by, and nothing discrete anywhere in its path.
 *
 * It does not darken its own row either, and not by being masked: an outer
 * box-shadow is painted only OUTSIDE the border box it belongs to. Give the
 * slab the row's own footprint and the row's own movement, and the hole in the
 * middle of the shadow stays exactly over the cards at every scale. The seams
 * between the cards are covered too, which is right — a row that lifts should
 * lift as one slab, not as two or three tiles with light between them. */
function ShadowCast({ box, depth }: { box: RowBox; depth: Depth }) {
  return (
    <motion.div
      className="pointer-events-none absolute"
      style={{
        left: box.left,
        top: box.top,
        width: box.width,
        height: box.height,
        /* above every cell, which run 1 to 5 */
        zIndex: 20,
        scale: depth.grow,
        y: depth.shadowY,
      }}
      aria-hidden="true"
    >
      <motion.div
        className="absolute inset-0"
        style={{ opacity: depth.contact, boxShadow: CONTACT }}
      />
      <motion.div
        className="absolute inset-0"
        style={{ opacity: depth.ambient, boxShadow: AMBIENT }}
      />
    </motion.div>
  );
}

/* ─────────────────────────────── one card ─────────────────────────────── */

/* Grey at rest — an archive of the town rather than six adverts — and the
   whole picture comes back the moment it is reached for.
 *
 * THE GREY IS NOT THE DARK. Those are two separate jobs and they were fighting
 * each other: a picture dimmed far enough to carry type anywhere on it has no
 * tonal range left once the colour has been taken out of it too, and six tiles
 * that all read as the same near-black rectangle tell a visitor nothing about
 * what is behind them. So the grade keeps its brightness up and pushes contrast
 * past 1 to buy back the separation greyscale costs, and the darkening the
 * label needs is done by the gradient under the label — locally, where it is
 * wanted, rather than across the whole picture.
 *
 * Hover is only one of three ways in. A keyboard gets the same picture on
 * focus and a finger gets it on the press. All three set the same one thing,
 * and the styles are written once against it. */
const LIT =
  "group-hover:grayscale-0 group-hover:saturate-[1.15] group-hover:brightness-[1.06] group-hover:contrast-[1.02] " +
  "group-focus-visible:grayscale-0 group-focus-visible:saturate-[1.15] group-focus-visible:brightness-[1.06] group-focus-visible:contrast-[1.02] " +
  "group-data-[lit=true]:grayscale-0 group-data-[lit=true]:saturate-[1.15] group-data-[lit=true]:brightness-[1.06] group-data-[lit=true]:contrast-[1.02]";

const ZOOM =
  "group-hover:scale-[1.03] group-focus-visible:scale-[1.03] group-data-[lit=true]:scale-[1.02]";

const SHIFT =
  "group-hover:translate-x-[5px] group-focus-visible:translate-x-[5px] group-data-[lit=true]:translate-x-[5px]";

const REACH_OUT =
  "group-hover:w-8 group-focus-visible:w-8 group-data-[lit=true]:w-8 md:group-hover:w-10 md:group-focus-visible:w-10";

function Card({
  category,
  label,
  alt,
}: {
  category: InfoCategory;
  label: string;
  alt: string;
}) {
  const [lit, setLit] = useState(false);

  /* A press lights the tile and letting go puts it back. It is deliberately
     not held past the release: a phone has no way to say "the finger has moved
     on", so a tile kept lit after a tap becomes a hover state that nothing can
     ever clear, and the visitor is left with one tile out of six stuck in
     colour for the rest of the page. */
  const press = {
    onPointerDown: () => setLit(true),
    onPointerUp: () => setLit(false),
    onPointerLeave: () => setLit(false),
    onPointerCancel: () => setLit(false),
  };

  const skin =
    "group relative block aspect-square overflow-hidden bg-night-2 outline-none " +
    "ring-1 ring-gold/0 transition-[box-shadow] duration-500 focus-visible:ring-gold/45";

  const inside = (
    <>
      {/* the picture, and the grade it wears at rest */}
      <div
        className={`absolute inset-0 grayscale contrast-[1.06] brightness-[0.68] transition-[filter] duration-[620ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${LIT}`}
      >
        <div
          className={`absolute inset-0 transition-transform duration-[620ms] ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform ${ZOOM}`}
        >
          <InfoPhoto
            category={category}
            sizes="(min-width: 768px) 32vw, 50vw"
          />
        </div>
      </div>

      {/* the room falling across the foot of the picture, so the name has
          something to sit on whatever the photograph turns out to be — and so
          the darkening the label needs happens here rather than over the whole
          tile */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[58%]"
        style={{
          background:
            "linear-gradient(to top, rgba(8,5,13,0.9), rgba(8,5,13,0.42) 44%, transparent)",
        }}
        aria-hidden="true"
      />

      <span
        className={`pointer-events-none absolute inset-x-0 bottom-0 flex items-center gap-2.5 p-4 transition-transform duration-[620ms] ease-[cubic-bezier(0.16,1,0.3,1)] sm:gap-3 md:p-5 ${SHIFT}`}
      >
        <span className="text-[0.5625rem] font-medium uppercase leading-none tracking-[0.22em] text-[#f7f0dd] [text-shadow:0_1px_2px_rgba(6,3,11,0.9),0_3px_12px_rgba(6,3,11,0.75)] sm:text-[0.625rem] sm:tracking-[0.26em] md:text-[0.6875rem] md:tracking-[0.28em]">
          {label}
        </span>
        <Arrow
          className={`w-4 shrink-0 text-gold-light/85 md:w-5 ${REACH_OUT}`}
        />
      </span>
    </>
  );

  /* A card with somewhere to go is a link, and announces itself as one. A card
     without one is a picture with a name under it — the five pages behind
     these do not exist yet, and a control that does nothing is worse to land
     on with a screen reader than a plain figure is. Give the entry an href in
     lib/local-info.ts and it becomes a real link, focus treatment and all,
     with nothing here to change. */
  if (!category.href) {
    return (
      <figure className={skin} data-lit={lit} {...press}>
        {inside}
        <figcaption className="sr-only">{alt}</figcaption>
      </figure>
    );
  }

  return (
    <Link href={category.href} className={skin} data-lit={lit} {...press}>
      {inside}
      <span className="sr-only">{alt}</span>
    </Link>
  );
}
