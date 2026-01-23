/**
 * Validation utilities for forms
 */

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate that a value is not empty
 */
export function validateRequired(
  value: string | number | null | undefined,
  fieldName?: string
): ValidationResult {
  const isEmpty =
    value === null ||
    value === undefined ||
    (typeof value === 'string' && value.trim() === '');
  return {
    valid: !isEmpty,
    error: isEmpty ? (fieldName ? `${fieldName} is required` : 'This field is required') : undefined,
  };
}

/**
 * Validate minimum string length
 */
export function validateMinLength(
  value: string,
  min: number,
  fieldName?: string
): ValidationResult {
  const valid = value.length >= min;
  return {
    valid,
    error: valid ? undefined : `${fieldName || 'Field'} must be at least ${min} characters`,
  };
}

/**
 * Validate maximum string length
 */
export function validateMaxLength(
  value: string,
  max: number,
  fieldName?: string
): ValidationResult {
  const valid = value.length <= max;
  return {
    valid,
    error: valid ? undefined : `${fieldName || 'Field'} must be at most ${max} characters`,
  };
}

/**
 * Validate a number value with optional min/max constraints
 */
export function validateNumber(
  value: number | string,
  options?: {
    min?: number;
    max?: number;
    integer?: boolean;
    fieldName?: string;
  }
): ValidationResult {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  const { min, max, integer, fieldName } = options || {};

  if (isNaN(num)) {
    return { valid: false, error: `${fieldName || 'Value'} must be a number` };
  }
  if (integer && !Number.isInteger(num)) {
    return { valid: false, error: `${fieldName || 'Value'} must be a whole number` };
  }
  if (min !== undefined && num < min) {
    return { valid: false, error: `${fieldName || 'Value'} must be at least ${min}` };
  }
  if (max !== undefined && num > max) {
    return { valid: false, error: `${fieldName || 'Value'} must be at most ${max}` };
  }
  return { valid: true };
}

/**
 * Validate a guild tag format (2-5 uppercase letters/numbers)
 */
export function validateGuildTag(value: string): ValidationResult {
  if (!value.trim()) {
    return { valid: false, error: 'Tag is required' };
  }
  if (value.length < 2 || value.length > 5) {
    return { valid: false, error: 'Tag must be 2-5 characters' };
  }
  if (!/^[A-Z0-9]+$/.test(value)) {
    return { valid: false, error: 'Tag must only contain uppercase letters and numbers' };
  }
  return { valid: true };
}

/**
 * Validate a positive amount with optional available balance check
 */
export function validatePositiveAmount(
  value: number | string,
  available?: number,
  fieldName?: string
): ValidationResult {
  const num = typeof value === 'string' ? parseFloat(value) : value;

  if (isNaN(num) || num <= 0) {
    return { valid: false, error: `${fieldName || 'Amount'} must be greater than 0` };
  }
  if (available !== undefined && num > available) {
    return {
      valid: false,
      error: `${fieldName || 'Amount'} exceeds available balance (${available})`,
    };
  }
  return { valid: true };
}

/**
 * Validate email format
 */
export function validateEmail(value: string): ValidationResult {
  if (!value.trim()) {
    return { valid: false, error: 'Email is required' };
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(value)) {
    return { valid: false, error: 'Invalid email format' };
  }
  return { valid: true };
}

/**
 * Debounce a function call
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Combine multiple validation results
 */
export function combineValidations(...results: ValidationResult[]): ValidationResult {
  for (const result of results) {
    if (!result.valid) {
      return result;
    }
  }
  return { valid: true };
}
