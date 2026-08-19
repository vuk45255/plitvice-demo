/* The plan's own ink.
 *
 * The house palette, restated for a drawing rather than for a page: the room
 * is near-black, the architecture is warm white held right back, and gold is
 * spent on one thing only — the table the guest has chosen. Nothing here is a
 * status colour in the traffic-light sense; a table that is gone simply falls
 * further into the dark than the ones that are not.
 *
 * Restyling the map is this file. */

export const INK = {
  /* the room the plan is drawn in */
  ground: "#08050d",
  /* the floor inside the walls — deep royal purple, barely raised */
  floor: "rgba(18,10,31,0.72)",
  /* the architecture: thin brass, the same hairline the site rules are drawn
     with, so the room is described rather than outlined in white */
  floorEdge: "rgba(200,164,93,0.3)",
  /* anything solid: the block, the service run, the stage */
  structure: "rgba(244,240,230,0.04)",
  structureEdge: "rgba(200,164,93,0.17)",
  /* stairs, drawn as a run of treads */
  tread: "rgba(200,164,93,0.24)",
  /* orientation type, in the house's warm white */
  label: "rgba(244,240,230,0.3)",
  labelArea: "rgba(200,164,93,0.5)",
  /* The zone's numeral, set behind everything. Warm white leaning violet, at
     full strength here — the mark's own opacity is what holds it back, and
     that is where it belongs, because it is the one thing about a zone mark
     worth adjusting per zone. */
  zoneMark: "#e7ddf2",

  /* A table nobody has touched: a quiet gold outline and almost no fill. */
  seat: "rgba(200,164,93,0.45)",
  seatFill: "rgba(200,164,93,0.05)",
  /* Under the cursor: the same table, lit. */
  seatHover: "rgba(232,216,168,0.9)",
  seatHoverFill: "rgba(200,164,93,0.14)",
  /* Chosen: the lamp itself, with a ring of light around it. */
  seatPicked: "#e8d8a8",
  seatPickedFill: "rgba(200,164,93,0.24)",
  seatPickedGlow: "rgba(232,216,168,0.6)",
  /* Gone. Dimmed rather than coloured, and not clickable. */
  seatTaken: "rgba(244,240,230,0.1)",
  seatTakenFill: "rgba(244,240,230,0.015)",

  /* the id set inside a booth, and on everything once the map is zoomed in */
  seatId: "rgba(244,240,230,0.42)",
  seatIdPicked: "rgba(232,216,168,0.95)",
} as const;

/* Ids only start appearing once a table is big enough to carry one. */
export const ID_VISIBLE_AT = 2.2;
