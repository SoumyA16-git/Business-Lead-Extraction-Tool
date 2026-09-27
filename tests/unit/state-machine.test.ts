import { describe, expect, it } from "vitest";
import {
  applySessionAction,
  isValidTransition,
} from "../../src/core/engine/state-machine";
import { ExtractionSession } from "../../src/core/schema/session";
import { DEFAULT_EXTRACTION_SETTINGS } from "../../src/shared/settings";

function createMockSession(): ExtractionSession {
  return {
    sessionId: "sess-1",
    platform: "google_maps",
    sourceUrl: "https://maps.google.com",
    searchContext: { query: "dentist", locationHint: null },
    status: "idle",
    pauseReason: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    queue: [],
    processedCount: 0,
    successCount: 0,
    partialCount: 0,
    failedCount: 0,
    duplicateCount: 0,
    websiteCount: 0,
    socialCount: 0,
    noWebsiteCount: 0,
    settingsSnapshot: DEFAULT_EXTRACTION_SETTINGS,
  };
}

describe("Session State Machine (PRD Section 22.2)", () => {
  it("transitions from idle to running on START", () => {
    const session = createMockSession();
    const updated = applySessionAction(session, { type: "START" });
    expect(updated.status).toBe("running");
  });

  it("transitions from running to paused with correct reason", () => {
    let session = createMockSession();
    session = applySessionAction(session, { type: "START" });
    const paused = applySessionAction(session, {
      type: "PAUSE",
      reason: "verification_required",
    });
    expect(paused.status).toBe("paused");
    expect(paused.pauseReason).toBe("verification_required");
  });

  it("resumes from paused to running clearing pauseReason", () => {
    let session = createMockSession();
    session = applySessionAction(session, { type: "START" });
    session = applySessionAction(session, { type: "PAUSE", reason: "user" });
    const resumed = applySessionAction(session, { type: "RESUME" });
    expect(resumed.status).toBe("running");
    expect(resumed.pauseReason).toBe(null);
  });

  it("transitions from running to completed on QUEUE_EXHAUSTED", () => {
    let session = createMockSession();
    session = applySessionAction(session, { type: "START" });
    const completed = applySessionAction(session, { type: "QUEUE_EXHAUSTED" });
    expect(completed.status).toBe("completed");
  });

  it("transitions from running to stopped on STOP preserving progress", () => {
    let session = createMockSession();
    session = applySessionAction(session, { type: "START" });
    session.processedCount = 25;
    const stopped = applySessionAction(session, { type: "STOP" });
    expect(stopped.status).toBe("stopped");
    expect(stopped.processedCount).toBe(25);
  });

  it("rejects invalid transitions", () => {
    expect(isValidTransition("idle", "completed")).toBe(false);
    expect(isValidTransition("completed", "paused")).toBe(false);
  });
});
