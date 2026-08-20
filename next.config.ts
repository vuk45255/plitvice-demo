import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: { root: __dirname },

  allowedDevOrigins: [
    "192.168.1.26",
    "makeup-shipment-affiliates-hall.trycloudflare.com",
  ],

  /* HIDDEN FOR THE DEMO — the story at /o-nama is not finished, so nobody is
     let in through the front door of the deployed site: typing the address
     lands on the home page instead. The route, the page and every component
     behind it are untouched and go on being built locally, because `next dev`
     is not a production build and the redirect is simply not there.

     The redirect is temporary (307), never permanent (308): a browser is
     entitled to cache a permanent one and would go on refusing the page long
     after it has gone live. Delete this block to publish the story. */
  async redirects() {
    if (process.env.NODE_ENV !== "production") return [];
    return [{ source: "/o-nama", destination: "/", permanent: false }];
  },
};

export default nextConfig;
