"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

type Entrance = {
  /* False until the hero's mark has finished revealing. Nothing but the
     club — no navigation, no chrome — may appear before this flips. */
  entered: boolean;
  enter: () => void;
  /* THE CEREMONY IS AN ARRIVAL, NOT A TOLL GATE.
   *
   * True once the home page's entrance has actually been played through. It is
   * a different fact from `entered`: every internal page opens the doors on
   * arrival, because a guest who came straight to /o-nama should not be
   * looking at a page with no navigation on it — but none of them has shown
   * anybody the ceremony.
   *
   * WHY IT LIVES HERE. This provider is mounted by app/(site)/layout.tsx,
   * above everything the router swaps out, so it survives every navigation
   * inside the club's own pages. /rezervacija and back, /info/restorani and
   * back, the browser's own Back button — the layout is not remounted, so this
   * is still true and the home page is simply usable on arrival: no reveal, no
   * scroll lock, nothing to wait through.
   *
   * A RELOAD IS A NEW ARRIVAL. This is memory, not storage: a fresh document
   * starts with it false and the ceremony plays, which is exactly the rule
   * asked for — the first genuine entry sees the club open its doors, and
   * walking back in from the next room does not. */
  ceremonyPlayed: boolean;
  ceremonyOver: () => void;
  /* THE CURTAIN — components/site-loader.tsx.
   *
   *   "down"     the branded loader is covering the page while the first
   *              screen's own resources arrive. Nothing that is a moment —
   *              the hero's reveal, the record sliding in — may start under
   *              it, because nobody would see it happen.
   *   "lifted"   the loader played and has just let go. The hero takes that
   *              as its cue and opens straight into its reveal: the curtain
   *              and the mark are one entrance, not a curtain followed by a
   *              second wait for a scroll.
   *   "none"     there was no curtain this time — the session has been
   *              through the door already, or the site was entered from
   *              somewhere inside the app. Everything behaves exactly as it
   *              did before there was a loader.
   *
   * It starts "down" on the server and through hydration, because the loader
   * is in the server's HTML; the loader settles it in its first layout
   * effect. */
  curtain: Curtain;
  setCurtain: (curtain: Exclude<Curtain, "down">) => void;
};

export type Curtain = "down" | "lifted" | "none";

/* Default is "entered" so anything rendered outside the provider still shows.
   `ceremonyPlayed` is false for the same reason the hero would want it: a
   hero rendered outside the provider is a hero on a fresh page. */
const EntranceContext = createContext<Entrance>({
  entered: true,
  enter: () => {},
  ceremonyPlayed: false,
  ceremonyOver: () => {},
  curtain: "none",
  setCurtain: () => {},
});

export function useEntrance() {
  return useContext(EntranceContext);
}

export function EntranceProvider({ children }: { children: React.ReactNode }) {
  const [entered, setEntered] = useState(false);
  const [ceremonyPlayed, setCeremonyPlayed] = useState(false);
  const [curtain, setCurtainState] = useState<Curtain>("down");

  const enter = useCallback(() => setEntered(true), []);
  const ceremonyOver = useCallback(() => setCeremonyPlayed(true), []);
  /* One way only: once up, the curtain never comes back down for the life of
     the layout. */
  const setCurtain = useCallback(
    (next: Exclude<Curtain, "down">) =>
      setCurtainState((current) => (current === "down" ? next : current)),
    [],
  );

  const value = useMemo(
    () => ({ entered, enter, ceremonyPlayed, ceremonyOver, curtain, setCurtain }),
    [entered, enter, ceremonyPlayed, ceremonyOver, curtain, setCurtain],
  );

  return (
    <EntranceContext.Provider value={value}>
      {children}
    </EntranceContext.Provider>
  );
}
