import { ThemeProvider } from "@/components/providers/theme-provider";
import { SmoothScroll } from "@/components/providers/smooth-scroll";
import { EntranceProvider } from "@/components/providers/entrance";
import { LanguageProvider } from "@/components/providers/language";
import { MixProvider } from "@/components/providers/mix";
import { VinylPlayer } from "@/components/mix/vinyl-player";

/* Everything the visitor came for — and everything that costs something.
 *
 * The site's chrome used to hang off the root layout, which meant every route
 * in the project carried it: smooth scroll, the entrance ceremony, the record
 * on the right-hand edge, the dictionary. That is correct for the club's
 * pages and wrong for the two operational ones. A guest holding a phone at
 * the door, and a doorman scanning it, want a page and nothing else — see
 * app/(operations)/layout.tsx.
 *
 * So the providers moved down one level into this group. NOTHING ELSE
 * CHANGED: a route group is invisible in a URL, every page below is the page
 * it was, and the tree it renders inside is the tree it rendered inside
 * before. The root layout above still owns <html>, the fonts, the theme
 * script and the metadata, because those belong to the document rather than
 * to the site. */

export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <ThemeProvider>
      <SmoothScroll>
        <LanguageProvider>
          {/* The mix belongs to the site, not to a page. Both the element and
              the record that drives it are mounted here, above everything the
              router swaps out, so internal navigation never interrupts what is
              playing. */}
          <MixProvider>
            <EntranceProvider>{children}</EntranceProvider>
            <VinylPlayer />
          </MixProvider>
        </LanguageProvider>
      </SmoothScroll>
    </ThemeProvider>
  );
}
