/**
 * Site-wide constants. No magic strings in pages or components.
 */

export const SITE = {
  name: "Westbridge",
  wordmark: "WESTBRIDGE",
  legal: "INC.",
  tagline: "Enterprise intelligence for growing businesses",
  domain: "westbridge.gy",
  appDomain: "app.westbridge.gy",
  /** Path to main logo (black/white mark + wordmark). Use in Navbar, Sidebar, Login. */
  logoPath: "/images/logo.png",
  /** Favicon (same logo, or use logoPath in metadata). */
  faviconPath: "/images/logo.png",
} as const;

export const ROUTES = {
  home: "/",
  pricing: "/pricing",
  modules: "/modules",
  about: "/about",
  login: "/login",
  signup: "/signup",
  dashboard: "/dashboard",
  forgotPassword: "/forgot-password",
  resetPassword: "/reset-password",
  invite: "/invite",
  terms: "/terms",
  privacy: "/privacy",
} as const;

export const TRIAL = {
  days: 14,
  noCardRequired: true,
} as const;

/** Display currency for marketing (pricing). USD only. */
export const CURRENCY = {
  primary: "USD",
  defaultDisplay: "USD" as const,
  label: "USD",
  supported: ["USD"] as const,
} as const;
