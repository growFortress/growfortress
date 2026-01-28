/* tslint:disable */
/* eslint-disable */

/**
 * Divide two fixed-point numbers (Q16.16)
 *
 * Formula: (a << 16) / b
 * Uses 64-bit intermediate to avoid overflow when shifting
 */
export function div(a: number, b: number): number;

/**
 * Q16.16 Fixed-Point Math Operations
 *
 * All operations use 64-bit intermediate values to avoid overflow
 * and ensure deterministic results across platforms.
 *
 * Format: Q16.16 (16 bits integer, 16 bits fractional)
 * - FP.ONE = 65536 (represents 1.0)
 * - Precision: 1/65536 ≈ 0.0000153
 * Multiply two fixed-point numbers (Q16.16)
 *
 * Formula: (a * b) >> 16
 * Uses 64-bit intermediate to avoid overflow
 */
export function mul(a: number, b: number): number;

/**
 * Square root of a fixed-point number (Q16.16)
 *
 * Uses Newton's method with 64-bit intermediate precision
 * Input and output are both Q16.16 format
 */
export function sqrt(fp: number): number;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly div: (a: number, b: number) => number;
    readonly mul: (a: number, b: number) => number;
    readonly sqrt: (a: number) => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
