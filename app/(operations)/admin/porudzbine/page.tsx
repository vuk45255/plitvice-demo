import { permanentRedirect } from "next/navigation";

/* THE OLD ADDRESS OF THE ORDERS SCREEN.
 *
 * It moved to /admin/karte, where the admissions are listed inside their
 * orders rather than counted next to them. Staff have this one in their
 * history and in each other's messages, and a bookmark that 404s at midnight
 * is a bookmark somebody rings about — so it redirects, with the search and
 * the chosen night carried across. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AdminOrdersMoved({
  searchParams,
}: PageProps<"/admin/porudzbine">) {
  const params = await searchParams;
  const query = new URLSearchParams();
  if (typeof params.q === "string" && params.q) query.set("q", params.q);
  if (typeof params.event === "string" && params.event) query.set("event", params.event);
  const tail = query.toString();
  permanentRedirect(tail ? `/admin/karte?${tail}` : "/admin/karte");
}
