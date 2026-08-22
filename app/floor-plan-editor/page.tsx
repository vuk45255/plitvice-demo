import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { FloorPlanEditor } from "@/components/floor-plan/editor/floor-plan-editor";

/* The floor plan's workbench — development only.
 *
 * The club's drawing is a working document, not a page, so this route refuses
 * to exist in a production build: `notFound()` fires before the editor is ever
 * rendered, and the page is marked off-limits to crawlers besides. The
 * photograph it uses lives in public/reference/, which is deleted before
 * shipping — see the note in lib/floor-plan.ts. */

export const metadata: Metadata = {
  title: "Floor plan editor",
  robots: { index: false, follow: false },
};

export default function FloorPlanEditorPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <FloorPlanEditor />;
}
