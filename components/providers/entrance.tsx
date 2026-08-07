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
};

/* Default is "entered" so anything rendered outside the provider still shows. */
const EntranceContext = createContext<Entrance>({
  entered: true,
  enter: () => {},
});

export function useEntrance() {
  return useContext(EntranceContext);
}

export function EntranceProvider({ children }: { children: React.ReactNode }) {
  const [entered, setEntered] = useState(false);
  const enter = useCallback(() => setEntered(true), []);
  const value = useMemo(() => ({ entered, enter }), [entered, enter]);

  return (
    <EntranceContext.Provider value={value}>
      {children}
    </EntranceContext.Provider>
  );
}
