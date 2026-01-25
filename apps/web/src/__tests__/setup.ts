/**
 * Test setup for web application unit tests
 */
import { vi, beforeEach, afterEach } from 'vitest';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock localStorage - use interface to avoid self-reference
interface MockLocalStorage {
  store: Record<string, string>;
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
  clear: () => void;
  readonly length: number;
  key: (index: number) => string | null;
}

const store: Record<string, string> = {};
const localStorageMock: MockLocalStorage = {
  store,
  getItem: vi.fn((key: string): string | null => store[key] ?? null),
  setItem: vi.fn((key: string, value: string): void => {
    store[key] = value;
  }),
  removeItem: vi.fn((key: string): void => {
    delete store[key];
  }),
  clear: vi.fn((): void => {
    Object.keys(store).forEach(key => delete store[key]);
  }),
  get length(): number {
    return Object.keys(store).length;
  },
  key: vi.fn((index: number): string | null => Object.keys(store)[index] ?? null),
};
Object.defineProperty(global, 'localStorage', { value: localStorageMock });

// Mock requestAnimationFrame
let rafId = 0;
global.requestAnimationFrame = vi.fn((_callback: FrameRequestCallback): number => {
  return ++rafId;
});
global.cancelAnimationFrame = vi.fn((_id: number): void => {});

// Mock performance
global.performance = {
  ...global.performance,
  now: vi.fn(() => Date.now()),
};

// Reset mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
  localStorageMock.clear();
  rafId = 0;
});

afterEach(() => {
  vi.restoreAllMocks();
});

// Export for use in tests
export { mockFetch, localStorageMock };
