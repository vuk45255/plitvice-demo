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
};

/* Default is "entered" so anything rendered outside the provider still shows.
   `ceremonyPlayed` is false for the same reason the hero would want it: a
   hero rendered outside the provider is a hero on a fresh page. */
const EntranceContext = createContext<Entrance>({
  entered: true,
  enter: () => {},
  ceremonyPlayed: false,
  ceremonyOver: () => {},
});

export function useEntrance() {
  return useContext(EntranceContext);
}

export function EntranceProvider({ children }: { children: React.ReactNode }) {
  const [entered, setEntered] = useState(false);
  const [ceremonyPlayed, setCeremonyPlayed] = useState(false);

  const enter = useCallback(() => setEntered(true), []);
  const ceremonyOver = useCallback(() => setCeremonyPlayed(true), []);

  const value = useMemo(
    () => ({ entered, enter, ceremonyPlayed, ceremonyOver }),
    [entered, enter, ceremonyPlayed, ceremonyOver],
  );

  return (
    <EntranceContext.Provider value={value}>
      {children}
    </EntranceContext.Provider>
  );
}
