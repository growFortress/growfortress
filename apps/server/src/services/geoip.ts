import geoip from "geoip-lite";
import type { FastifyRequest } from "fastify";
import type { Currency } from "@arcade/protocol";

const EU_COUNTRIES = new Set([
  "AT",
  "BE",
  "BG",
  "HR",
  "CY",
  "CZ",
  "DK",
  "EE",
  "FI",
  "FR",
  "DE",
  "GR",
  "HU",
  "IE",
  "IT",
  "LV",
  "LT",
  "LU",
  "MT",
  "NL",
  "PT",
  "RO",
  "SK",
  "SI",
  "ES",
  "SE",
]);

const LOCAL_IPS = new Set(["127.0.0.1", "::1"]);

function normalizeIp(ip: string | undefined): string | null {
  if (!ip) return null;
  const trimmed = ip.split(",")[0]?.trim();
  if (!trimmed) return null;
  if (trimmed.includes(":") && !trimmed.includes("::")) {
    const [host] = trimmed.split(":");
    return host || null;
  }
  return trimmed;
}

function getRequestIp(request: FastifyRequest): string | null {
  const headerIp =
    normalizeIp(request.headers["x-forwarded-for"] as string | undefined) ||
    normalizeIp(request.headers["x-real-ip"] as string | undefined);
  const requestIp = normalizeIp(request.ip);
  return headerIp || requestIp;
}

export function getCountryFromRequest(request: FastifyRequest): string | null {
  const ip = getRequestIp(request);
  if (!ip || LOCAL_IPS.has(ip)) {
    return null;
  }
  const result = geoip.lookup(ip);
  return result?.country ?? null;
}

export function getDefaultCurrencyForCountry(country: string | null): Currency {
  if (country === "PL") {
    return "PLN";
  }
  if (country && EU_COUNTRIES.has(country)) {
    return "EUR";
  }
  return "USD";
}

export function resolveLocaleDefaults(request: FastifyRequest): {
  country: string | null;
  currency: Currency;
} {
  const country = getCountryFromRequest(request);
  const currency = getDefaultCurrencyForCountry(country);
  return { country, currency };
}
