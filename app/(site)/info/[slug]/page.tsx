import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { InfoDirectory } from "@/components/local-info/info-directory";
import { InfoRoute } from "@/components/local-info/info-route";
import { PAGE_COPY, PLACES } from "@/lib/info-places";
import { INFO, categoryBySlug } from "@/lib/local-info";
import { messages } from "@/lib/i18n";

/* THE SIX PAGES BEHIND THE SIX CARDS.
 *
 * One route rather than six files. Everything that differs between them is
 * data — see lib/local-info.ts for the categories and lib/info-places.ts for
 * what each page holds — so six near-identical page components would only be
 * six places for them to drift apart. `generateStaticParams` means this still
 * prerenders as six static pages, exactly as six files would have.
 *
 * Five of them are directories and one is the road here; that is the only
 * branch on this route, and it is a branch of one. */

export function generateStaticParams() {
  return INFO.map((category) => ({ slug: category.slug }));
}

/* Nothing else is a page. A stray /info/<anything> is a 404 rather than an
   empty directory, and the route is `dynamicParams: false` so the six are the
   only ones that exist at all. */
export const dynamicParams = false;

/* Serbian, because that is what the server renders and what an unset visitor
   gets — see components/providers/language.tsx. The page's copy switches with
   the language switcher on the client; its <title> is what a search engine and
   a shared link see, and that is one language by definition. */
export async function generateMetadata(
  props: PageProps<"/info/[slug]">,
): Promise<Metadata> {
  const { slug } = await props.params;
  const category = categoryBySlug(slug);
  if (!category) return {};

  const title = `${messages.sr[category.name]} — Inđija`;
  const description = messages.sr[PAGE_COPY[slug].lead];

  return {
    title,
    description,
    openGraph: {
      title: `${title} — Plitvice`,
      description,
      url: `/info/${slug}`,
    },
  };
}

export default async function InfoPage(props: PageProps<"/info/[slug]">) {
  const { slug } = await props.params;
  const category = categoryBySlug(slug);

  if (!category) notFound();

  /* The road here has no directory behind it and never will — it is one
     address. Everything with places under it is a directory. */
  return PLACES[category.id] ? (
    <InfoDirectory category={category} />
  ) : (
    <InfoRoute category={category} />
  );
}
