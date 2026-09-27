/**
 * Time, Delay, Jitter, and Exponential Backoff Helpers
 * Defined in PRD Section 16.1
 */

import { MIN_DELAY_FLOOR } from "../shared/settings";

export function delayMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Uniform randomized jitter between minSeconds and maxSeconds,
 * enforcing minimum delay floor of 2.5s per PRD Section 16.1
 */
export function getJitteredDelayMs(minSeconds = 3.5, maxSeconds = 6.0): number {
  if (minSeconds === 0 && maxSeconds === 0) {
    return 0;
  }
  const min = Math.max(MIN_DELAY_FLOOR, minSeconds);
  const max = Math.max(min, maxSeconds);
  const jitterSeconds = min + Math.random() * (max - min);
  return Math.round(jitterSeconds * 1000);
}

/**
 * Exponential backoff after extraction error:
 * base 4s * 2^retryCount, capped at 60s per PRD Section 16.1
 */
export function getExponentialBackoffMs(retryCount: number, baseSeconds = 4.0, maxSeconds = 60.0): number {
  if (baseSeconds === 0) {
    return 0;
  }
  const delaySec = Math.min(maxSeconds, baseSeconds * Math.pow(2, retryCount));
  return Math.round(delaySec * 1000);
}
