/**
 * WASM Wrapper for Q16.16 Fixed-Point Math
 *
 * Provides lazy loading and fallback detection for the fixed-math WASM module.
 * Falls back to BigInt-based implementation when WASM is not available.
 */

type WasmModule = {
  mul(a: number, b: number): number;
  div(a: number, b: number): number;
  sqrt(fp: number): number;
};

// Check if WASM should be disabled (e.g., in tests for deterministic results)
// This is a function to allow runtime checking
function isWasmDisabled(): boolean {
  return typeof process !== 'undefined' && process.env?.DISABLE_WASM === 'true';
}

let wasmModule: WasmModule | null = null;
let wasmLoadPromise: Promise<WasmModule | null> | null = null;
let wasmAvailable = false;

/**
 * Load WASM module (lazy, only when needed)
 * Returns null if WASM is not available (e.g., in Node.js without WASM support)
 */
async function loadWasm(): Promise<WasmModule | null> {
  // Disable WASM in test environments for deterministic BigInt-based results
  if (isWasmDisabled()) {
    wasmAvailable = false;
    return null;
  }

  // If already loaded or failed, return cached result
  if (wasmModule !== null) return wasmModule;
  if (wasmLoadPromise !== null) return wasmLoadPromise;

  // Start loading
  wasmLoadPromise = (async () => {
    try {
      // Try to load WASM module
      // In browser: import from dist/wasm/fixed_math.js
      // In Node.js: may not be available, so we catch and fallback

      // Dynamic import - path will be resolved at build time
      // The WASM module is built to packages/sim-core/dist/wasm/ by wasm-pack
      // In browser environments, this will load the WASM module
      // In Node.js test environments, this may fail and fallback to BigInt
      try {
        // Try to import WASM module (path relative to dist/ after build)
        // wasm-pack generates: fixed_math.js and fixed_math_bg.wasm
        // Use dynamic path construction to prevent Rollup from statically analyzing
        const wasmPath = '../dist/wasm/fixed_math' + '.js';
        // @ts-ignore - WASM module may not exist at compile time, runtime fallback handles this
        const wasmImport = await import(/* @vite-ignore */ wasmPath);

        // The module has a default export that initializes the WASM binary
        // We need to call it to actually load the .wasm file
        if (typeof wasmImport.default === 'function') {
          await wasmImport.default();
        }

        // Now the module exports the functions directly
        wasmModule = wasmImport as unknown as WasmModule;
        wasmAvailable = true;
        return wasmModule;
      } catch (importError) {
        // Import failed - will fall through to return null below
        throw importError;
      }
    } catch (error) {
      // WASM not available - fallback to BigInt
      // This is expected in Node.js test environments
      wasmAvailable = false;
      return null;
    }
  })();

  return wasmLoadPromise;
}

/**
 * Initialize WASM module synchronously (for immediate use)
 * This will attempt to load WASM, but will not block if it fails
 */
export function initWasm(): void {
  // Trigger lazy load (fire and forget)
  loadWasm().catch(() => {
    // Silent fail - will use BigInt fallback
  });
}

/**
 * Check if WASM is available
 */
export function isWasmAvailable(): boolean {
  return wasmAvailable && wasmModule !== null;
}

/**
 * Get WASM module (returns null if not available)
 */
export function getWasmModule(): WasmModule | null {
  return wasmModule;
}

/**
 * Multiply using WASM if available, otherwise null (caller should use fallback)
 */
export async function mulWasm(a: number, b: number): Promise<number | null> {
  const module = await loadWasm();
  if (module) {
    return module.mul(a, b);
  }
  return null;
}

/**
 * Divide using WASM if available, otherwise null (caller should use fallback)
 */
export async function divWasm(a: number, b: number): Promise<number | null> {
  const module = await loadWasm();
  if (module) {
    return module.div(a, b);
  }
  return null;
}

/**
 * Square root using WASM if available, otherwise null (caller should use fallback)
 */
export async function sqrtWasm(fp: number): Promise<number | null> {
  const module = await loadWasm();
  if (module) {
    return module.sqrt(fp);
  }
  return null;
}

/**
 * Synchronous versions (for immediate use after initialization)
 * These will use WASM if already loaded, otherwise return null
 */
export function mulWasmSync(a: number, b: number): number | null {
  if (isWasmDisabled()) return null;
  if (wasmModule) {
    return wasmModule.mul(a, b);
  }
  return null;
}

export function divWasmSync(a: number, b: number): number | null {
  if (isWasmDisabled()) return null;
  if (wasmModule) {
    return wasmModule.div(a, b);
  }
  return null;
}

export function sqrtWasmSync(fp: number): number | null {
  if (isWasmDisabled()) return null;
  if (wasmModule) {
    return wasmModule.sqrt(fp);
  }
  return null;
}
