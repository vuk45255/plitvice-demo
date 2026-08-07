"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

/* Every "Rezervacija" on the site — the header, the hero, the photograph in
   the VIP chapter, the location column, the footer — pulls the same handle.
   One room, opened from many doors. */
type Reservation = {
  open: boolean;
  openReservation: () => void;
  closeReservation: () => void;
};

const ReservationContext = createContext<Reservation>({
  open: false,
  openReservation: () => {},
  closeReservation: () => {},
});

export function useReservation() {
  return useContext(ReservationContext);
}

export function ReservationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const openReservation = useCallback(() => setOpen(true), []);
  const closeReservation = useCallback(() => setOpen(false), []);

  const value = useMemo(
    () => ({ open, openReservation, closeReservation }),
    [open, openReservation, closeReservation],
  );

  return (
    <ReservationContext.Provider value={value}>
      {children}
    </ReservationContext.Provider>
  );
}
