"use client";

import { useRef } from "react";
import Image from "next/image";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { useLang } from "@/components/providers/language";
import { EASE } from "@/components/reveal";
import {
  menuMarks,
  priceList,
  type MarkId,
  type PriceCategory,
  type PriceItem,
} from "@/lib/drinks-menu";
import type { Lang } from "@/lib/i18n";

/* THE CENOVNIK ITSELF — twelve categories, fifty-nine drinks, and not one
 * number written anywhere but lib/drinks-menu.ts.
 *
 * TWO COLUMNS ON A DESKTOP, NOT THREE. Three was the obvious reading of a
 * list this long and it is the wrong one: at three columns a row is about
 * 300px wide, which is not enough for "Domaća vodka (za mikseve) (0,03)" and
 * a price and a run of dots between them, and the moment the leader is
 * squeezed to nothing the page stops looking like a menu in a club and starts
 * looking like a table in a PDF. At two the rows are wide, the leaders are
 * long, and the whole thing breathes. Which category falls in which column is
 * `column` in the data — the left is everything soft and everything from a
 * vineyard, the right is everything from a still.
 *
 * ON A PHONE THE COLUMNS ARE NOT COLUMNS. The grid collapses to one and the
 * categories run in the order they are written, full width, which is why the
 * left column carries the water and the sokovi: a phone reads top to bottom
 * and should open on the most ordinary thing on the list rather than on
 * champagne.
 *
 * The marks behind it all are placed in the data too. Everything this file
 * decides about them is how they move. */

/* How far across its own category a mark reaches before the page cuts it off
 * at the edge of the screen. A left-hand mark's right edge lands here; a
 * right-hand mark's left edge does. Under a third and over two thirds — so
 * the middle of every column, where the eye actually travels down a list of
 * prices, is never underneath anything. */
const REACH = "70%";

/* And how it gives out as it comes toward the type. Solid on the side it
 * bleeds off, gone by the time it reaches the middle of the column, so what
 * sits behind a price is always the room and never a bottle. This is the
 * whole readability argument: not low opacity alone, which dims a mark evenly
 * and still leaves it competing under the text, but a mark that is only ever
 * present on the outside of the page. */
const MASK = {
  left: "linear-gradient(to right, #000 0%, #000 34%, transparent 88%)",
  right: "linear-gradient(to left, #000 0%, #000 34%, transparent 88%)",
} as const;

export function PriceList() {
  const { lang } = useLang();
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);

  /* One scroll reading for the whole list, shared by all five marks. Each one
     maps it to its own small signed distance, so they separate as the page
     goes by instead of sliding as a sheet. Read from the list rather than
     from the window: the offsets below are the list entering the bottom of
     the screen and leaving the top of it. */
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const left = priceList.filter((c) => c.column === 1);
  const right = priceList.filter((c) => c.column === 2);

  return (
    <div
      ref={ref}
      className="relative grid gap-x-16 gap-y-20 md:grid-cols-2 md:gap-y-0 lg:gap-x-24 xl:gap-x-32"
    >
      <Column
        categories={left}
        lang={lang}
        progress={scrollYProgress}
        reduced={!!reduced}
      />
      <Column
        categories={right}
        lang={lang}
        progress={scrollYProgress}
        reduced={!!reduced}
      />
    </div>
  );
}

function Column({
  categories,
  lang,
  progress,
  reduced,
}: {
  categories: PriceCategory[];
  lang: Lang;
  progress: MotionValue<number>;
  reduced: boolean;
}) {
  return (
    <div className="flex flex-col gap-20 md:gap-24">
      {categories.map((category) => (
        <Category
          key={category.id}
          category={category}
          lang={lang}
          progress={progress}
          reduced={reduced}
        />
      ))}
    </div>
  );
}

function Category({
  category,
  lang,
  progress,
  reduced,
}: {
  category: PriceCategory;
  lang: Lang;
  progress: MotionValue<number>;
  reduced: boolean;
}) {
  const headingId = `cenovnik-${category.id}`;

  return (
    <section
      id={category.id}
      aria-labelledby={headingId}
      /* `relative` is what the mark hangs off; `isolate` keeps the mark's
         stacking inside this category, so it can never come up over the
         category after it. */
      className="relative isolate"
    >
      {category.mark ? (
        <Mark id={category.mark} progress={progress} reduced={reduced} />
      ) : null}

      <motion.div
        initial={reduced ? false : { opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-8% 0px" }}
        transition={{ duration: reduced ? 0 : 0.8, ease: EASE }}
        className="relative z-10"
      >
        {/* Small, uppercase, wide, gold — and set in the house serif rather
            than the sans the rails elsewhere use, because a category heading
            on a price list is a title and not an eyebrow. */}
        <h2
          id={headingId}
          className="font-serif text-[0.78rem] uppercase leading-none tracking-[0.34em] text-gold md:text-[0.85rem]"
        >
          {category.title[lang]}
        </h2>

        {/* The rule under the heading — the only separator on the page that is
            a line. Everything below it is separated by dots and by air. */}
        <div className="mt-5 h-px w-full bg-gold/20" aria-hidden="true" />

        <dl className="mt-6 md:mt-7">
          {category.items.map((item, i) => (
            <Row key={`${item.name}-${item.volume}-${i}`} item={item} />
          ))}
        </dl>
      </motion.div>
    </section>
  );
}

function Row({ item }: { item: PriceItem }) {
  return (
    <div
      className={`menu-row py-2 md:py-2.5 ${item.group ? "mt-7 md:mt-8" : ""}`}
    >
      <dt className="min-w-0 text-[0.9375rem] leading-snug text-night-ink/85 md:text-base">
        {item.name}{" "}
        {/* The measure, in the parentheses the club prints it in. Held back
            from the name so a row reads as one thing with a footnote rather
            than as two, and kept unbreakable so "(0,187)" can never be split
            across a line. */}
        <span className="whitespace-nowrap text-[0.85em] text-night-ink/40">
          ({item.volume})
        </span>
      </dt>

      <span className="menu-leader" aria-hidden="true" />

      <dd className="menu-price shrink-0 text-[0.9375rem] leading-snug text-night-ink md:text-base">
        {item.price}{" "}
        {/* The unit, once per row but never at the weight of the figure:
            large enough to answer the question, small enough that fifty-nine
            of them down a page still read as a menu. The space before it is a
            real one rather than margin alone, so a screen reader says "180
            RSD" and not "180RSD"; the margin then tops it up to the gap the
            tracking wants. */}
        <span className="ml-1 text-[0.62em] tracking-[0.18em] text-gold/55">
          RSD
        </span>
      </dd>
    </div>
  );
}

/* One brand mark, bleeding off its own side of the page.
 *
 * Decorative in the strict sense — `aria-hidden`, an empty alt, and nothing
 * under it is clickable — so it is announced to nobody and intercepts
 * nothing. The only thing it does is move, and it moves by a couple of dozen
 * pixels across an entire page of scrolling. */
function Mark({
  id,
  progress,
  reduced,
}: {
  id: MarkId;
  progress: MotionValue<number>;
  reduced: boolean;
}) {
  const mark = menuMarks[id];

  /* Called unconditionally — reduced motion flattens the range rather than
     skipping the hook. */
  const y = useTransform(
    progress,
    [0, 1],
    reduced ? [0, 0] : [-mark.drift, mark.drift],
  );

  return (
    <motion.div
      aria-hidden="true"
      style={{
        y,
        width: mark.size,
        top: mark.lift,
        [mark.side === "left" ? "right" : "left"]: REACH,
        maskImage: MASK[mark.side],
        WebkitMaskImage: MASK[mark.side],
      }}
      /* The outer opacity is the phone's; the image carries its own on top of
         it and the two multiply. A mark on a 390px screen has none of the
         room a desktop column gives it, so it comes most of the way back down
         into the dark. */
      className="pointer-events-none absolute -z-10 select-none opacity-40 md:opacity-100"
    >
      <Image
        src={mark.src}
        alt=""
        width={mark.width}
        height={mark.height}
        sizes="(max-width: 767px) 60vw, 640px"
        className="h-auto w-full"
        style={{ opacity: mark.ink }}
      />
    </motion.div>
  );
}
