/** @type {import('next').NextConfig} */
const desktop = process.env.CADENCELAB_DESKTOP_EXPORT === "1";
const nextConfig = {
  output: desktop ? "export" : undefined,
  distDir: desktop ? ".next-desktop" : ".next",
  images: { unoptimized: desktop },
  env: { NEXT_PUBLIC_DESKTOP_BUILD: desktop ? "1" : "0" },
  experimental: { middlewareClientMaxBodySize: "32mb" },
  rewrites: desktop ? undefined : async () => {
    return [
      {
        source: "/api/v1/:path*",
        destination: "http://127.0.0.1:8000/api/v1/:path*",
      },
    ];
  },
};

export default nextConfig;
