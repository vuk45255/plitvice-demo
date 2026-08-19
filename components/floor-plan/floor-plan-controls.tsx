"use client";

import { useLang } from "@/components/providers/language";

/* Closer, further, and back to the whole club.
 *
 * Three hairline controls, stacked, with the same brass edge everything else
 * on the site is drawn with. They are the keyboard and thumb route to the same
 * thing a wheel or a pinch does, so nothing on this map is reachable one way
 * only. */

function Control({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="flex h-11 w-11 items-center justify-center border border-line bg-night/70 text-night-ink/70 backdrop-blur-md transition-colors duration-500 hover:border-gold/45 hover:text-gold-light disabled:opacity-30 disabled:hover:border-line disabled:hover:text-night-ink/70"
    >
      {children}
    </button>
  );
}

export function FloorPlanControls({
  onZoomIn,
  onZoomOut,
  onReset,
  canZoomIn,
  canZoomOut,
}: {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  canZoomIn: boolean;
  canZoomOut: boolean;
}) {
  const { t } = useLang();

  return (
    <div className="flex flex-col gap-2">
      <Control label={t("floor.zoomIn")} onClick={onZoomIn} disabled={!canZoomIn}>
        <span className="relative block h-4 w-4" aria-hidden="true">
          <span className="absolute left-0 top-1/2 h-px w-4 -translate-y-1/2 bg-current" />
          <span className="absolute left-1/2 top-0 h-4 w-px -translate-x-1/2 bg-current" />
        </span>
      </Control>

      <Control label={t("floor.zoomOut")} onClick={onZoomOut} disabled={!canZoomOut}>
        <span className="block h-px w-4 bg-current" aria-hidden="true" />
      </Control>

      <Control label={t("floor.reset")} onClick={onReset}>
        {/* a frame — the whole room back in view */}
        <span
          className="block h-4 w-4 border border-current"
          style={{ borderRadius: 2 }}
          aria-hidden="true"
        />
      </Control>
    </div>
  );
}
