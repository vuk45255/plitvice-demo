"use client";

import { useCallback, useRef, useState } from "react";
import { useMix } from "@/components/providers/mix";
import { useLang } from "@/components/providers/language";

/* The line through the set.
 *
 * A hairline, a lit length of it, and a small handle — nothing that looks like
 * a browser control. The whole strip is the target rather than the hairline
 * itself: the rule is one pixel tall, and one pixel is not something anyone
 * can hit, so the hit area is a band around it and the drawing sits inside.
 *
 * Pointer capture does the dragging, which means one code path for a mouse, a
 * pen and a finger, and a drag that keeps working after it leaves the strip.
 * It is a slider to a screen reader too, with the arrow keys moving in tens of
 * seconds and Home and End going to the ends of the mix. */

/* What one press of an arrow key is worth, in seconds. */
const NUDGE = 10;
const JUMP = 60;

export function MixTimeline({ compact = false }: { compact?: boolean }) {
  const { currentTime, duration, seek } = useMix();
  const { t } = useLang();
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const ratio = duration > 0 ? Math.min(currentTime / duration, 1) : 0;

  const seekToPointer = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track || duration <= 0) return;
      const box = track.getBoundingClientRect();
      if (box.width === 0) return;
      const position = (clientX - box.left) / box.width;
      seek(Math.min(Math.max(position, 0), 1) * duration);
    },
    [duration, seek],
  );

  return (
    <div
      ref={trackRef}
      role="slider"
      tabIndex={0}
      aria-label={t("mix.seek")}
      aria-valuemin={0}
      aria-valuemax={Math.round(duration)}
      aria-valuenow={Math.round(currentTime)}
      aria-orientation="horizontal"
      onPointerDown={(event) => {
        if (duration <= 0) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        setDragging(true);
        seekToPointer(event.clientX);
      }}
      onPointerMove={(event) => {
        if (!dragging) return;
        seekToPointer(event.clientX);
      }}
      onPointerUp={(event) => {
        event.currentTarget.releasePointerCapture(event.pointerId);
        setDragging(false);
      }}
      onPointerCancel={() => setDragging(false)}
      onKeyDown={(event) => {
        if (duration <= 0) return;
        const step =
          event.key === "ArrowRight" || event.key === "ArrowUp"
            ? NUDGE
            : event.key === "ArrowLeft" || event.key === "ArrowDown"
              ? -NUDGE
              : event.key === "PageUp"
                ? JUMP
                : event.key === "PageDown"
                  ? -JUMP
                  : 0;
        if (step !== 0) {
          event.preventDefault();
          seek(currentTime + step);
          return;
        }
        if (event.key === "Home") {
          event.preventDefault();
          seek(0);
        } else if (event.key === "End") {
          event.preventDefault();
          seek(duration);
        }
      }}
      className={`group relative flex w-full cursor-pointer touch-none items-center focus-visible:outline-none ${
        compact ? "h-7" : "h-8"
      }`}
    >
      {/* the unlit length */}
      <span
        className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-gold/20"
        aria-hidden="true"
      />
      {/* and the part of it that has been played */}
      <span
        className="absolute left-0 top-1/2 h-px -translate-y-1/2 bg-gold-light/80"
        style={{ width: `${ratio * 100}%` }}
        aria-hidden="true"
      />
      {/* the handle, sitting on the end of it */}
      <span
        className={`absolute top-1/2 block rounded-full bg-gold-light transition-[height,width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          dragging ? "h-[9px] w-[9px]" : "h-[6px] w-[6px] group-hover:h-[9px] group-hover:w-[9px]"
        }`}
        style={{
          left: `${ratio * 100}%`,
          transform: "translate(-50%, -50%)",
        }}
        aria-hidden="true"
      />
      {/* the ring that shows the strip has the keyboard */}
      <span
        className="pointer-events-none absolute -inset-x-2 top-1/2 h-6 -translate-y-1/2 rounded-[2px] opacity-0 ring-1 ring-gold/50 group-focus-visible:opacity-100"
        aria-hidden="true"
      />
    </div>
  );
}
