const USER_ID_KEY = "arcade_user_id";
const DISPLAY_NAME_KEY = "arcade_display_name";

let accessToken: string | null = null;

type AuthInvalidationListener = () => void;
const authInvalidationListeners = new Set<AuthInvalidationListener>();

export function onAuthInvalidated(
  listener: AuthInvalidationListener,
): () => void {
  authInvalidationListeners.add(listener);
  return () => authInvalidationListeners.delete(listener);
}

function notifyAuthInvalidated(): void {
  authInvalidationListeners.forEach((listener) => {
    try {
      listener();
    } catch (error) {
      console.error("Auth invalidation listener failed", error);
    }
  });
}

// Safe localStorage wrappers for private browsing mode compatibility
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

export function getAccessToken(): string | null {
  return accessToken;
}

export function getUserId(): string | null {
  return safeGetItem(USER_ID_KEY);
}

export function getDisplayName(): string | null {
  return safeGetItem(DISPLAY_NAME_KEY);
}

// Consolidated auth data setter for consistency
export function setAuthData(
  accessTokenValue: string,
  userId?: string,
  displayName?: string,
): void {
  accessToken = accessTokenValue;
  if (userId) {
    safeSetItem(USER_ID_KEY, userId);
  }
  if (displayName) {
    safeSetItem(DISPLAY_NAME_KEY, displayName);
  }
}

// Legacy function - consider migrating to setAuthData
export function setTokens(
  accessTokenValue: string,
  _refreshToken?: string,
  userId?: string,
): void {
  setAuthData(accessTokenValue, userId);
}

export function setDisplayName(displayName: string): void {
  safeSetItem(DISPLAY_NAME_KEY, displayName);
}

export function clearTokens(): void {
  accessToken = null;
  safeRemoveItem(USER_ID_KEY);
  safeRemoveItem(DISPLAY_NAME_KEY);
  notifyAuthInvalidated();
}

// JWT token expiration check
export function isTokenExpired(): boolean {
  const token = getAccessToken();
  if (!token) return true;

  try {
    // JWT structure: header.payload.signature
    const parts = token.split(".");
    if (parts.length !== 3) return true;

    // Decode base64url payload
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payload.padEnd(Math.ceil(payload.length / 4) * 4, "=");
    const decoded = JSON.parse(atob(padded));

    // Check exp claim (in seconds)
    if (!decoded.exp) return false; // No expiration claim

    const expirationTime = decoded.exp * 1000; // Convert to milliseconds
    const currentTime = Date.now();

    return currentTime >= expirationTime;
  } catch {
    console.warn("Failed to parse token expiration");
    return true; // Assume expired if we can't parse
  }
}

export function isAuthenticated(): boolean {
  return !!getAccessToken() && !isTokenExpired();
}
