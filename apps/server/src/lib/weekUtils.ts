/**
 * Week Utilities
 *
 * Consolidated ISO 8601 week calculation functions for consistent
 * week key generation across the codebase.
 */

/**
 * Get ISO 8601 week number for a given date.
 * Week 1 is the week containing January 4th.
 */
function getISOWeekNumber(date: Date): { year: number; week: number } {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

  // Set to nearest Thursday: current date + 4 - current day number
  // Make Sunday day 7
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);

  // Get first day of year
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));

  // Calculate full weeks to nearest Thursday
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);

  return { year: d.getUTCFullYear(), week: weekNo };
}

/**
 * Get current week key in ISO 8601 format (YYYY-Www)
 * Example: "2024-W03"
 */
export function getCurrentWeekKey(): string {
  const { year, week } = getISOWeekNumber(new Date());
  return `${year}-W${week.toString().padStart(2, '0')}`;
}

/**
 * Get previous week key in ISO 8601 format
 */
export function getPreviousWeekKey(): string {
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const { year, week } = getISOWeekNumber(oneWeekAgo);
  return `${year}-W${week.toString().padStart(2, '0')}`;
}

/**
 * Get the start of a week (Monday 00:00:00 UTC) from a week key
 */
export function getWeekStart(weekKey: string): Date {
  const match = weekKey.match(/^(\d{4})-W(\d{2})$/);
  if (!match) throw new Error(`Invalid week key: ${weekKey}`);

  const year = parseInt(match[1], 10);
  const week = parseInt(match[2], 10);

  // January 4th is always in week 1
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4DayOfWeek = jan4.getUTCDay() || 7; // Convert Sunday from 0 to 7

  // Calculate the Monday of week 1
  const week1Monday = new Date(jan4.getTime() - (jan4DayOfWeek - 1) * 86400000);

  // Calculate the Monday of the target week
  const targetMonday = new Date(week1Monday.getTime() + (week - 1) * 7 * 86400000);

  return targetMonday;
}

/**
 * Get the end of a week (Sunday 23:59:59.999 UTC) from a week key
 */
export function getWeekEnd(weekKey: string): Date {
  const weekStart = getWeekStart(weekKey);
  // Sunday 23:59:59.999 = Monday + 6 days + 23:59:59.999
  return new Date(weekStart.getTime() + 6 * 86400000 + 23 * 3600000 + 59 * 60000 + 59 * 1000 + 999);
}

/**
 * Parse a week key and return its components
 */
export function parseWeekKey(weekKey: string): { year: number; week: number } {
  const match = weekKey.match(/^(\d{4})-W(\d{2})$/);
  if (!match) throw new Error(`Invalid week key: ${weekKey}`);

  return {
    year: parseInt(match[1], 10),
    week: parseInt(match[2], 10),
  };
}

/**
 * Get week key for a specific date
 */
export function getWeekKeyForDate(date: Date): string {
  const { year, week } = getISOWeekNumber(date);
  return `${year}-W${week.toString().padStart(2, '0')}`;
}
