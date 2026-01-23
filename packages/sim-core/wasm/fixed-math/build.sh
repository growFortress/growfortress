#!/bin/bash
# Build script for fixed-math WASM module

set -e

echo "Building fixed-math WASM module..."

# Check if wasm-pack is installed
if ! command -v wasm-pack &> /dev/null; then
    echo "Error: wasm-pack is not installed"
    echo "Install it with: cargo install wasm-pack"
    exit 1
fi

# Build with wasm-pack
# Target: wasm32-unknown-unknown (no stdlib, maximum compatibility)
# Mode: release (optimized)
wasm-pack build --target web --release --out-dir ../../dist/wasm

echo "WASM module built successfully!"
echo "Output: packages/sim-core/dist/wasm/"
