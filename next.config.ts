import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: { root: __dirname },

  /* THE TWO DATABASE DRIVERS ARE NOT BUNDLED.
   *
   * `pg` reaches for optional native modules and resolves its own dialect
   * files at run time; PGlite is a three-megabyte WebAssembly binary loaded
   * from disk. Both break, in different and confusing ways, if a bundler
   * tries to be clever about them — so they are marked external and loaded by
   * Node itself. Only whichever one is actually in use is ever imported; see
   * the dynamic imports in lib/db/client.ts. */
  serverExternalPackages: ["pg", "@electric-sql/pglite"],

  allowedDevOrigins: [
    "192.168.1.26",
    "makeup-shipment-affiliates-hall.trycloudflare.com",
  ],
};

export default nextConfig;
