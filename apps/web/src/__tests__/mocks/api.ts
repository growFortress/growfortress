/**
 * API mock utilities for testing
 */
import { vi } from 'vitest';

/**
 * Create a mock fetch response
 */
export function createMockResponse<T>(
  data: T,
  options: {
    status?: number;
    ok?: boolean;
    contentType?: string;
    headers?: Record<string, string>;
  } = {}
): Response {
  const {
    status = 200,
    ok = status >= 200 && status < 300,
    contentType = 'application/json',
    headers = {},
  } = options;

  const allHeaders = new Headers({
    'content-type': contentType,
    ...headers,
  });

  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    headers: allHeaders,
    json: vi.fn().mockResolvedValue(data),
    text: vi.fn().mockResolvedValue(JSON.stringify(data)),
    blob: vi.fn().mockResolvedValue(new Blob()),
    arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
    formData: vi.fn().mockResolvedValue(new FormData()),
    clone: vi.fn(),
    body: null,
    bodyUsed: false,
    redirected: false,
    type: 'basic' as ResponseType,
    url: '',
  } as unknown as Response;
}

/**
 * Create a mock 204 No Content response
 */
export function createNoContentResponse(): Response {
  return createMockResponse({}, { status: 204, contentType: '' });
}

/**
 * Create a mock error response
 */
export function createErrorResponse(
  status: number,
  error: string,
  code?: string,
  data?: Record<string, unknown>
): Response {
  return createMockResponse(
    { error, code, ...(data || {}) },
    { status, ok: false }
  );
}

/**
 * Create a mock 401 Unauthorized response
 */
export function create401Response(error = 'Unauthorized'): Response {
  return createErrorResponse(401, error, 'UNAUTHORIZED');
}

/**
 * Create a mock 403 Forbidden response
 */
export function create403Response(error = 'Forbidden'): Response {
  return createErrorResponse(403, error, 'FORBIDDEN');
}

/**
 * Create a mock 404 Not Found response
 */
export function create404Response(error = 'Not found'): Response {
  return createErrorResponse(404, error, 'NOT_FOUND');
}

/**
 * Create a mock 500 Internal Server Error response
 */
export function create500Response(error = 'Internal server error'): Response {
  return createErrorResponse(500, error, 'INTERNAL_ERROR');
}

/**
 * Create a mock network error
 */
export function createNetworkError(): Error {
  return new Error('Failed to fetch');
}

/**
 * Mock successful token refresh
 */
export function createTokenRefreshResponse(accessToken = 'new-access-token', displayName = 'TestUser'): Response {
  return createMockResponse({ accessToken, displayName });
}
