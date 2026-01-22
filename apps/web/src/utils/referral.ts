const REFERRAL_CODE_KEY = "arcade_referral_code";

function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    console.warn(`Failed to read ${key} from localStorage`);
    return null;
  }
}

function safeSetItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    console.warn(`Failed to write ${key} to localStorage`);
  }
}

function safeRemoveItem(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    console.warn(`Failed to remove ${key} from localStorage`);
  }
}

export function getReferralCode(): string | null {
  return safeGetItem(REFERRAL_CODE_KEY);
}

export function setReferralCode(code: string): void {
  const trimmed = code.trim();
  if (!trimmed) return;
  safeSetItem(REFERRAL_CODE_KEY, trimmed.toUpperCase());
}

export function clearReferralCode(): void {
  safeRemoveItem(REFERRAL_CODE_KEY);
}

export function captureReferralCodeFromUrl(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  const url = new URL(window.location.href);
  const rawCode = url.searchParams.get("ref") || url.searchParams.get("invite");
  if (!rawCode) {
    return null;
  }

  const normalized = rawCode.trim().toUpperCase();
  if (!normalized) {
    return null;
  }

  if (!getReferralCode()) {
    setReferralCode(normalized);
  }

  url.searchParams.delete("ref");
  url.searchParams.delete("invite");
  window.history.replaceState({}, "", url.toString());

  return normalized;
}
