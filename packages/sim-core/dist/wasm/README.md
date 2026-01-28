# Fixed-Math WASM Module

WASM module for Q16.16 fixed-point arithmetic operations with 64-bit intermediate precision.

## Building

Prerequisites:
- Rust toolchain
- `wasm-pack`: `cargo install wasm-pack`

Build:
```bash
npm run build:wasm
# or
cd wasm/fixed-math && bash build.sh
```

Output: `packages/sim-core/dist/wasm/`

## Operations

- `mul(a: i32, b: i32) -> i32` - Multiply with 64-bit intermediate
- `div(a: i32, b: i32) -> i32` - Divide with 64-bit intermediate
- `sqrt(fp: i32) -> i32` - Square root with 64-bit precision

All operations use standardized truncation: always truncate to i32 immediately after the operation.
