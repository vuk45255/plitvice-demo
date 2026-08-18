import type { Metadata, Viewport } from "next";
import { Great_Vibes, Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { SmoothScroll } from "@/components/providers/smooth-scroll";
import { EntranceProvider } from "@/components/providers/entrance";
import { LanguageProvider } from "@/components/providers/language";

const playfair = Playfair_Display({
  subsets: ["latin", "latin-ext"],
  variable: "--font-playfair",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-inter",
  display: "swap",
});

/* The hero's "Grand Club" on a phone, and nowhere else. One weight is all
   the family ships. */
const greatVibes = Great_Vibes({
  subsets: ["latin", "latin-ext"],
  weight: "400",
  variable: "--font-great-vibes",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://plitviceclub.com"),
  title: {
    default: "Plitvice — Grand Club · Inđija",
    template: "%s — Plitvice",
  },
  description:
    "Plitvice — klub u Inđiji. Muzika, svetlo i ljudi u jednoj prostoriji. Pažljivo biran zvuk, rezervisani stolovi, vrata otvorena do jutra. Petkom i subotom od 23h.",
  openGraph: {
    title: "Plitvice — Grand Club · Inđija",
    description:
      "Muzika, svetlo i ljudi u jednoj prostoriji. Pažljivo biran zvuk i rezervisani stolovi u Inđiji.",
    url: "/",
    siteName: "Plitvice",
    locale: "sr_RS",
    type: "website",
    images: [{ url: "/og.jpg", width: 1200, height: 630 }],
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#08050d" },
    { media: "(prefers-color-scheme: light)", color: "#faf7f2" },
  ],
};

/* Runs before paint: dark is the default, a stored "light" choice wins. */
const themeInit = `(function(){try{var t=localStorage.getItem("plitvice-theme");document.documentElement.classList.toggle("dark",t?t==="dark":true)}catch(e){document.documentElement.classList.add("dark")}})()`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="sr"
      className={`${playfair.variable} ${inter.variable} ${greatVibes.variable} dark antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body className="bg-surface text-ink font-sans">
        <ThemeProvider>
          <SmoothScroll>
            <LanguageProvider>
              <EntranceProvider>{children}</EntranceProvider>
            </LanguageProvider>
          </SmoothScroll>
        </ThemeProvider>
      </body>
    </html>
  );
}
