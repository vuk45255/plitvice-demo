/* WHAT THE OFFICE LOOKS LIKE WHILE IT IS COUNTING.
 *
 * Every admin page is `force-dynamic` and every number on one is a query, so
 * there is always a moment — a few hundred milliseconds on a laptop, longer on
 * a phone in a basement — where there is nothing to show. This is what stands
 * there.
 *
 * IT IS THE SHAPE OF WHAT IS COMING, not a spinner. A header block, a row of
 * cards, a panel: the page that arrives lands in the same places, so nothing
 * jumps. A spinner says "wait"; this says "here, nearly", and it does it
 * without measuring anything or loading a byte of JavaScript.
 *
 * One file, at the top of /admin, so every page underneath inherits it. */
export default function AdminLoading() {
  return (
    <div aria-hidden>
      <div className="pb-6 pt-1">
        <div className="adm-skel h-2 w-20" />
        <div className="adm-skel mt-3 h-7 w-64 max-w-full" />
      </div>

      <div className="adm-skel mb-6 h-28 w-full" />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="adm-skel h-[5.5rem]" />
        ))}
      </div>

      <div className="adm-skel h-64 w-full" />

      <span className="sr-only">Učitavanje…</span>
    </div>
  );
}
