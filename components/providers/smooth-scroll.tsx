"use client";

import { ReactLenis } from "lenis/react";

export function SmoothScroll({ children }: { children: React.ReactNode }) {
  return (
    <ReactLenis
      root
      options={{ duration: 1.15, smoothWheel: true, touchMultiplier: 1.4 }}
    >
      {children}
    </ReactLenis>
  );
}
