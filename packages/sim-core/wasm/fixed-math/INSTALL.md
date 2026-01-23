# Instalacja wymagań dla WASM build

Aby zbudować moduł WASM, potrzebujesz:

## 1. Zainstaluj Rust

### Windows
Pobierz i uruchom instalator z: https://rustup.rs/

Lub użyj PowerShell:
```powershell
# Pobierz i uruchom instalator
Invoke-WebRequest https://win.rustup.rs/x86_64 -OutFile rustup-init.exe
.\rustup-init.exe
```

### Linux/macOS
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

## 2. Zainstaluj wasm-pack

Po zainstalowaniu Rust, uruchom:

```bash
cargo install wasm-pack
```

## 3. Zbuduj moduł WASM

```bash
cd packages/sim-core
npm run build:wasm
```

Lub bezpośrednio:

```bash
cd packages/sim-core/wasm/fixed-math
wasm-pack build --target web --release --out-dir ../../dist/wasm
```

## Alternatywa: Użyj BigInt fallback

Jeśli nie chcesz instalować Rust, kod automatycznie użyje implementacji BigInt jako fallback. 
Wszystkie funkcje będą działać, ale WASM może być szybszy dla częstych operacji.
