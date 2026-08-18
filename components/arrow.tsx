/* The house arrow: a hairline with a head, drawn at the same weight as every
   other rule on the site. It grows on hover the way the underlines do — the
   caller owns that, through `group-hover:w-*` on the wrapper. */
export function Arrow({ className }: { className?: string }) {
  return (
    <span
      className={`relative block h-px bg-current transition-[width] duration-500 ${className ?? ""}`}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 8 8"
        className="absolute -right-px -top-[3.5px] h-[7px] w-[7px] overflow-visible"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      >
        <path d="M4 0.5 L7.5 4 L4 7.5" />
      </svg>
    </span>
  );
}
