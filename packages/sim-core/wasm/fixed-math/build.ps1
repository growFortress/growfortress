# Build script for fixed-math WASM module (PowerShell)

Write-Host "Building fixed-math WASM module..." -ForegroundColor Cyan

# Check if wasm-pack is installed
try {
    $wasmPackVersion = wasm-pack --version 2>&1
    Write-Host "Found wasm-pack: $wasmPackVersion" -ForegroundColor Green
} catch {
    Write-Host "Error: wasm-pack is not installed" -ForegroundColor Red
    Write-Host "Install Rust first: https://rustup.rs/" -ForegroundColor Yellow
    Write-Host "Then install wasm-pack: cargo install wasm-pack" -ForegroundColor Yellow
    exit 1
}

# Check if Rust is installed
try {
    $rustVersion = rustc --version 2>&1
    Write-Host "Found Rust: $rustVersion" -ForegroundColor Green
} catch {
    Write-Host "Error: Rust is not installed" -ForegroundColor Red
    Write-Host "Install Rust from: https://rustup.rs/" -ForegroundColor Yellow
    exit 1
}

# Build with wasm-pack
# Target: web (for browser compatibility)
# Mode: release (optimized)
Write-Host "Building WASM module..." -ForegroundColor Cyan
wasm-pack build --target web --release --out-dir ../../dist/wasm

if ($LASTEXITCODE -eq 0) {
    Write-Host "WASM module built successfully!" -ForegroundColor Green
    Write-Host "Output: packages/sim-core/dist/wasm/" -ForegroundColor Green
} else {
    Write-Host "Build failed!" -ForegroundColor Red
    exit 1
}
