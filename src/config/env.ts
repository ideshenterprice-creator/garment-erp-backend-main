export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

const DURATION_UNITS: Record<string, number> = {
  ms: 1,
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

export function parseDurationMs(value: string | undefined, fallbackMs: number): number {
  if (!value) return fallbackMs;
  const match = value.trim().match(/^(\d+)\s*(ms|s|m|h|d)$/i);
  if (!match) return fallbackMs;
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  if (!Number.isFinite(amount) || amount <= 0) return fallbackMs;
  return amount * (DURATION_UNITS[unit] ?? fallbackMs);
}

export function refreshCookieMaxAgeMs(): number {
  return parseDurationMs(process.env.JWT_REFRESH_EXPIRES_IN, 7 * 24 * 60 * 60 * 1000);
}

const PRODUCTION_FRONTEND_ORIGINS = [
  "https://garment-erp-frontend-ivory.vercel.app",
  "https://garment-erp-frontend-main-ebon.vercel.app",
];
const LOCAL_FRONTEND_ORIGIN = "http://localhost:3000";

function railwayPublicOrigin(): string | undefined {
  const raw = process.env.RAILWAY_PUBLIC_DOMAIN || process.env.RAILWAY_STATIC_URL;
  if (!raw) return undefined;
  const host = raw.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return host ? `https://${host}` : undefined;
}

export function isFabricFlowVercelOrigin(origin: string): boolean {
  return /^https:\/\/garment-erp-frontend[a-z0-9.-]*\.vercel\.app$/i.test(origin);
}

export function frontendUrl(): string {
  const value = process.env.FRONTEND_URL || process.env.APP_URL || LOCAL_FRONTEND_ORIGIN;
  return value.replace(/\/$/, "");
}

export function backendUrl(port = process.env.PORT ?? "5000"): string {
  const value = process.env.BACKEND_URL;
  if (value) return value.replace(/\/$/, "");
  const railway = railwayPublicOrigin();
  if (railway) return railway;
  return `http://localhost:${port}`;
}

export function corsAllowlist(): string[] {
  const raw = [process.env.CORS_ORIGIN, process.env.FRONTEND_URL, process.env.APP_URL]
    .filter((value): value is string => Boolean(value && value.trim()))
    .flatMap((value) => value.split(","))
    .map((value) => value.trim().replace(/\/$/, ""))
    .filter(Boolean);

  const unique = [
    ...new Set([
      ...raw,
      ...PRODUCTION_FRONTEND_ORIGINS,
      LOCAL_FRONTEND_ORIGIN,
    ]),
  ];
  return unique.length > 0 ? unique : [LOCAL_FRONTEND_ORIGIN];
}

export function isAllowedCorsOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  const normalized = origin.replace(/\/$/, "");
  if (corsAllowlist().includes(normalized)) return true;
  if (isFabricFlowVercelOrigin(normalized)) return true;
  if (isProduction()) return false;
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(normalized);
}

export function cookieSameSite(): "lax" | "none" | "strict" {
  const configured = (process.env.COOKIE_SAMESITE ?? "").toLowerCase();
  if (configured === "none" || configured === "lax" || configured === "strict") {
    return configured;
  }
  return isProduction() ? "none" : "lax";
}

export function inviteTtlMs(): number {
  const hours = Number(process.env.INVITE_EXPIRY ?? 48);
  const safeHours = Number.isFinite(hours) && hours > 0 ? hours : 48;
  return safeHours * 60 * 60 * 1000;
}

export function companyProfile() {
  return {
    name: process.env.COMPANY_NAME ?? "FabricFlow ERP",
    address: process.env.COMPANY_ADDRESS ?? "",
    contact: process.env.COMPANY_CONTACT ?? "",
    email: process.env.COMPANY_EMAIL ?? "",
    gstin: process.env.COMPANY_GSTIN ?? "",
  };
}

export function lowStockThreshold(): number {
  const value = Number(process.env.LOW_STOCK_THRESHOLD ?? 100);
  return Number.isFinite(value) && value >= 0 ? value : 100;
}
