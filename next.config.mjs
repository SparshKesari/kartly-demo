// Build flags default to "0" so the compiler always inlines a literal value.
for (let i = 1; i <= 12; i++) {
  const name = `NEXT_PUBLIC_KB_${String(i).padStart(2, "0")}`;
  if (process.env[name] === undefined) process.env[name] = "0";
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Lets the persistence spec run a second dev server without sharing .next with the main one.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  experimental: {
    instrumentationHook: true,
    // Ship the pristine seed with every serverless function so the database can be created on first request.
    outputFileTracingIncludes: {
      "/**/*": ["./data/seed.json"],
    },
  },
};

export default nextConfig;
