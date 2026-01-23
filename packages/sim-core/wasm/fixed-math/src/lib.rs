use wasm_bindgen::prelude::*;

/// Q16.16 Fixed-Point Math Operations
/// 
/// All operations use 64-bit intermediate values to avoid overflow
/// and ensure deterministic results across platforms.
/// 
/// Format: Q16.16 (16 bits integer, 16 bits fractional)
/// - FP.ONE = 65536 (represents 1.0)
/// - Precision: 1/65536 ≈ 0.0000153

/// Multiply two fixed-point numbers (Q16.16)
/// 
/// Formula: (a * b) >> 16
/// Uses 64-bit intermediate to avoid overflow
#[wasm_bindgen]
pub fn mul(a: i32, b: i32) -> i32 {
    // Convert to i64 for 64-bit arithmetic
    let a64 = a as i64;
    let b64 = b as i64;
    
    // Multiply in 64-bit, then shift right by 16 bits
    let result = (a64 * b64) >> 16;
    
    // Truncate to i32 (standardized truncation moment)
    result as i32
}

/// Divide two fixed-point numbers (Q16.16)
/// 
/// Formula: (a << 16) / b
/// Uses 64-bit intermediate to avoid overflow when shifting
#[wasm_bindgen]
pub fn div(a: i32, b: i32) -> i32 {
    if b == 0 {
        // Division by zero: return MAX for positive, MIN for negative
        return if a >= 0 { i32::MAX } else { i32::MIN };
    }
    
    // Convert to i64 for 64-bit arithmetic
    let a64 = a as i64;
    let b64 = b as i64;
    
    // Shift left by 16 bits in 64-bit, then divide
    let result = (a64 << 16) / b64;
    
    // Truncate to i32 (standardized truncation moment)
    result as i32
}

/// Square root of a fixed-point number (Q16.16)
/// 
/// Uses Newton's method with 64-bit intermediate precision
/// Input and output are both Q16.16 format
#[wasm_bindgen]
pub fn sqrt(fp: i32) -> i32 {
    if fp <= 0 {
        return 0;
    }
    
    // Convert to i64 for 64-bit arithmetic
    let fp64 = fp as i64;
    
    // Use integer square root with Newton's method
    // Start with initial guess
    let mut x = fp64;
    let mut y = (x + 1) >> 1;
    
    // Newton's method iteration
    while y < x {
        x = y;
        y = (x + (fp64 / x)) >> 1;
    }
    
    // Scale result to fixed-point: multiply by 2^8 (sqrt of 2^16)
    // This maintains Q16.16 format in the result
    let result = (x << 8) as i64;
    
    // Truncate to i32 (standardized truncation moment)
    result as i32
}
