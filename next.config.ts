import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: { root: __dirname },

  allowedDevOrigins: [
    "192.168.1.26",
    "makeup-shipment-affiliates-hall.trycloudflare.com",
  ],
};

export default nextConfig;