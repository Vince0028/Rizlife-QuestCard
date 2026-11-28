// Response headers applied to every route of all three portals (apps/*/next.config.ts).
// A plain .mjs file so next.config.ts can import it before @rizlife/shared is compiled.
// A full script/style CSP is left for later: it needs nonces for Next's inline scripts.
export const SECURITY_HEADERS = [
  // No portal may be framed (clickjacking on stamp/delete/admin actions).
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];
