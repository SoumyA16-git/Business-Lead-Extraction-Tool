/**
 * Session Utilities and Helpers
 * Defined in PRD Section 14
 */

import { ExtractionSession } from "../core/schema/session";

export const STALENESS_DAYS = 14;

/**
 * Checks if a session was created more than 14 days ago (PRD Section 14.4)
 */
export function isSessionStale(createdAt: string): boolean {
  const ageMs = Date.now() - new Date(createdAt).getTime();
  return ageMs > STALENESS_DAYS * 24 * 60 * 60 * 1000;
}

/**
 * Derives user-friendly display name for a session
 */
export function getSessionDisplayName(s: ExtractionSession): string {
  return s.customName || s.searchContext.query || `Session ${s.sessionId.slice(0, 8)}`;
}
