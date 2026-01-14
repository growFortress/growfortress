/**
 * Base API module with shared request logic and token refresh handling.
 * All API clients should use these utilities instead of implementing their own.
 */

import { CONFIG } from "../config.js";
import { getAccessToken, setAuthData, clearTokens } from "./auth.js";

// ============================================================================
// ERROR CLASSES
// ============================================================================

/**
 * Base API error class that all domain-specific errors should extend
 */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public data?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// ============================================================================
// TOKEN REFRESH - SINGLETON PATTERN
// ============================================================================

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

/**
 * Attempts to refresh the authentication token.
 * Uses singleton pattern to prevent multiple simultaneous refresh requests.
 *
 * @returns Promise<boolean> - true if refresh succeeded, false otherwise
 */
export async function tryRefreshToken(): Promise<boolean> {
  // If already refreshing, return the existing promise
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const response = await fetch(`${CONFIG.API_URL}/v1/auth/refresh`, {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        clearTokens();
        return false;
      }

      const data = await response.json();
      setAuthData(data.accessToken, undefined, data.displayName);
      return true;
    } catch {
      clearTokens();
      return false;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

// ============================================================================
// REQUEST OPTIONS
// ============================================================================

export interface RequestOptions extends RequestInit {
  /** Skip adding Authorization header */
  skipAuth?: boolean;
  /** Skip automatic token refresh on 401 */
  skipAuthRefresh?: boolean;
}

// ============================================================================
// BASE REQUEST FUNCTION
// ============================================================================

/**
 * Makes an authenticated API request with automatic token refresh on 401.
 *
 * @param path - API path (e.g., '/v1/users')
 * @param options - Fetch options plus custom auth options
 * @param retry - Whether to retry on 401 (internal use)
 * @returns Promise with the response data
 * @throws ApiError on non-OK responses
 */
export async function request<T>(
  path: string,
  options: RequestOptions = {},
  retry = true,
): Promise<T> {
  const url = `${CONFIG.API_URL}${path}`;

  const { skipAuth, skipAuthRefresh, ...fetchOptions } = options;

  const headers: Record<string, string> = {
    ...(fetchOptions.headers as Record<string, string>),
  };

  if (fetchOptions.body) {
    headers["Content-Type"] = "application/json";
  }

  if (!skipAuth) {
    const token = getAccessToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }

  const response = await fetch(url, {
    ...fetchOptions,
    headers,
    credentials: fetchOptions.credentials ?? "include",
  });

  if (!response.ok) {
    // Try to refresh token on 401
    if (response.status === 401 && retry && !skipAuthRefresh) {
      const refreshed = await tryRefreshToken();
      if (refreshed) {
        return request<T>(path, options, false);
      }
    }

    const data = await response.json().catch(() => ({}));
    throw new ApiError(
      response.status,
      data.error || "Request failed",
      data.code,
      data,
    );
  }

  // Handle empty responses (204 No Content)
  const contentType = response.headers.get("content-type");
  if (response.status === 204 || !contentType?.includes("application/json")) {
    return {} as T;
  }

  return response.json();
}

// ============================================================================
// DOMAIN-SPECIFIC ERROR FACTORIES
// ============================================================================

/**
 * Creates a domain-specific error class that extends ApiError.
 * Useful for catching specific API errors.
 *
 * @example
 * export class PvpApiError extends createDomainError('PvpApiError') {}
 */
export function createDomainError(name: string) {
  return class DomainApiError extends ApiError {
    constructor(
      status: number,
      message: string,
      code?: string,
      data?: unknown,
    ) {
      super(status, message, code, data);
      this.name = name;
    }
  };
}
