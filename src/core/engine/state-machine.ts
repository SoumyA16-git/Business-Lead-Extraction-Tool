/**
 * Session Status State Machine and Reducer
 * Defined in PRD Section 22.2
 */

import { ExtractionSession, PauseReason, SessionStatus } from "../schema/session";

export type SessionAction =
  | { type: "START" }
  | { type: "PAUSE"; reason: PauseReason }
  | { type: "RESUME" }
  | { type: "STOP" }
  | { type: "COMPLETE"; reason: "limit_reached" | "results_exhausted" | "user_stopped" }
  | { type: "QUEUE_EXHAUSTED" }
  | { type: "FAIL"; error: string };

/**
 * Transition rules matrix
 */
const VALID_TRANSITIONS: Record<SessionStatus, SessionStatus[]> = {
  idle: ["running", "detecting", "queued"],
  detecting: ["queued", "idle", "failed"],
  queued: ["running", "idle"],
  running: ["paused", "completed", "stopped", "failed"],
  paused: ["running", "stopped", "failed"],
  completed: ["running", "queued"], // Can restart/resume if new items discovered
  stopped: ["running", "queued"],
  failed: ["running", "queued", "idle"],
};

/**
 * Validates if transition from fromStatus to toStatus is permissible
 */
export function isValidTransition(fromStatus: SessionStatus, toStatus: SessionStatus): boolean {
  return VALID_TRANSITIONS[fromStatus]?.includes(toStatus) ?? false;
}

/**
 * Pure state reducer for extraction session transitions
 */
export function applySessionAction(
  session: ExtractionSession,
  action: SessionAction
): ExtractionSession {
  const updated: ExtractionSession = {
    ...session,
    updatedAt: new Date().toISOString(),
  };

  switch (action.type) {
    case "START": {
      if (isValidTransition(session.status, "running")) {
        updated.status = "running";
        updated.pauseReason = null;
        updated.completionReason = null;
      }
      break;
    }

    case "PAUSE": {
      if (isValidTransition(session.status, "paused")) {
        updated.status = "paused";
        updated.pauseReason = action.reason || "user";
      }
      break;
    }

    case "RESUME": {
      if (isValidTransition(session.status, "running")) {
        updated.status = "running";
        updated.pauseReason = null;
        updated.completionReason = null;
      }
      break;
    }

    case "STOP": {
      if (isValidTransition(session.status, "stopped")) {
        updated.status = "stopped";
        updated.completionReason = "user_stopped";
      }
      break;
    }

    case "COMPLETE": {
      if (isValidTransition(session.status, "completed")) {
        updated.status = "completed";
        updated.completionReason = action.reason;
      }
      break;
    }

    case "QUEUE_EXHAUSTED": {
      if (isValidTransition(session.status, "completed")) {
        updated.status = "completed";
        updated.completionReason = "results_exhausted";
      }
      break;
    }

    case "FAIL": {
      if (isValidTransition(session.status, "failed")) {
        updated.status = "failed";
      }
      break;
    }
  }

  return updated;
}
