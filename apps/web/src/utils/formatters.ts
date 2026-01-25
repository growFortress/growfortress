/**
 * Number and string formatting utilities
 */

/**
 * Format a number with appropriate suffix (K, M, B)
 */
export function formatNumber(num: number): string {
  if (num === 0) return '0';

  const absNum = Math.abs(num);
  const sign = num < 0 ? '-' : '';

  if (absNum >= 1_000_000_000) {
    return sign + (absNum / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + 'B';
  }
  if (absNum >= 1_000_000) {
    return sign + (absNum / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (absNum >= 10_000) {
    return sign + (absNum / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  if (absNum >= 1_000) {
    return sign + (absNum / 1_000).toFixed(2).replace(/\.00$/, '').replace(/0$/, '') + 'K';
  }
  return sign + Math.floor(absNum).toString();
}

/**
 * Format a number with commas (e.g., 1,234,567)
 */
export function formatWithCommas(num: number): string {
  return num.toLocaleString('en-US');
}

/**
 * Format percentage (0-1 to 0-100%)
 */
export function formatPercent(value: number, decimals = 0): string {
  return (value * 100).toFixed(decimals) + '%';
}

/**
 * Format time duration in hours/minutes
 */
export function formatDuration(hours: number): string {
  if (hours < 1) {
    const minutes = Math.floor(hours * 60);
    return `${minutes}m`;
  }

  const h = Math.floor(hours);
  const m = Math.floor((hours - h) * 60);

  if (m === 0) {
    return `${h}h`;
  }
  return `${h}h ${m}m`;
}
