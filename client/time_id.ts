/**
 * The identity a key is issued for: a moment, rounded up to {@link TIME_STEP_MS}.
 *
 * The server issues keys only for these, in one spelling — `2030-01-01T00:00:00Z`, UTC, whole
 * seconds, the last digit always 0 — and answers any other spelling of a moment with a redirect to
 * this one. Rounding up means a key is never released before the moment asked for, at most
 * {@link TIME_STEP_MS} after it. The key is bound to the exact string, so encrypt for `timeId(…)`, not for a date as you
 * happen to write it.
 */

/** Keys are issued every 10 seconds. */
export const TIME_STEP_MS = 10_000;

/**
 * The identity for a moment: `at` (a `Date`, epoch milliseconds, or any string `Date.parse`
 * accepts) rounded up to {@link TIME_STEP_MS}, as `YYYY-MM-DDTHH:MM:SSZ`.
 *
 * @throws {RangeError} when `at` is not a valid date.
 */
export function timeId(at: Date | number | string): string {
  const ms = typeof at === "string" ? Date.parse(at) : Number(at);
  if (!Number.isFinite(ms)) throw new RangeError(`Invalid date: ${at}`);
  const rounded = Math.ceil(ms / TIME_STEP_MS) * TIME_STEP_MS;
  return new Date(rounded).toISOString().replace(/\.\d{3}Z$/, "Z");
}
