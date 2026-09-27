import { beforeEach, describe, expect, it } from "vitest";
import { clearEntireDatabase, closeDb, getDb } from "../../src/core/storage/db";
import {
  bulkDeleteSessions,
  getAllSessions,
  getSession,
  renameSession,
  saveSession,
} from "../../src/core/storage/sessions-repo";
import { saveRecord, getRecordsBySession } from "../../src/core/storage/records-repo";
import { ExtractionSession } from "../../src/core/schema/session";
import { DEFAULT_EXTRACTION_SETTINGS } from "../../src/shared/settings";
import { isSessionStale } from "../../src/utils/session";

function createMockSession(sessionId: string, dateOffsetDays = 0): ExtractionSession {
  const date = new Date(Date.now() - dateOffsetDays * 24 * 60 * 60 * 1000);
  return {
    sessionId,
    customName: undefined,
    platform: "google_maps",
    sourceUrl: "https://maps.google.com/search/dentists",
    searchContext: { query: "dentists", locationHint: null },
    status: "completed",
    pauseReason: null,
    createdAt: date.toISOString(),
    updatedAt: date.toISOString(),
    queue: [],
    processedCount: 20,
    successCount: 18,
    partialCount: 2,
    failedCount: 0,
    duplicateCount: 1,
    websiteCount: 10,
    socialCount: 6,
    noWebsiteCount: 4,
    settingsSnapshot: DEFAULT_EXTRACTION_SETTINGS,
  };
}

describe("Multi-Session Management (PRD Section 14 & 41)", () => {
  beforeEach(async () => {
    closeDb();
    const db = await getDb();
    await db.clear("sessions");
    await db.clear("queue_items");
    await db.clear("business_records");
  });

  it("renames a session and persists customName", async () => {
    const session = createMockSession("sess-rename-1");
    await saveSession(session);

    const updated = await renameSession("sess-rename-1", "Bhubaneswar Dentists Q4");
    expect(updated?.customName).toBe("Bhubaneswar Dentists Q4");

    const retrieved = await getSession("sess-rename-1");
    expect(retrieved?.customName).toBe("Bhubaneswar Dentists Q4");
  });

  it("performs bulk deletion of multiple sessions", async () => {
    await saveSession(createMockSession("sess-del-1"));
    await saveSession(createMockSession("sess-del-2"));
    await saveSession(createMockSession("sess-del-3"));

    const initial = await getAllSessions();
    expect(initial.length).toBe(3);

    await bulkDeleteSessions(["sess-del-1", "sess-del-2"]);

    const remaining = await getAllSessions();
    expect(remaining.length).toBe(1);
    expect(remaining[0].sessionId).toBe("sess-del-3");
  });

  it("correctly identifies stale sessions (>14 days old per PRD 14.4)", () => {
    const freshDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(); // 2 days old
    const staleDate = new Date(Date.now() - 16 * 24 * 60 * 60 * 1000).toISOString(); // 16 days old

    expect(isSessionStale(freshDate)).toBe(false);
    expect(isSessionStale(staleDate)).toBe(true);
  });

  it("clears entire database wiping all sessions, records, and media", async () => {
    await saveSession(createMockSession("sess-wipe-1"));
    await saveSession(createMockSession("sess-wipe-2"));
    await saveRecord("sess-wipe-1", {
      record_id: "rec-wipe-1",
      business_name: "Test Clinic",
      primary_category: "Dentist",
      secondary_categories: [],
      rating: 4.8,
      review_count: 50,
      price_level: null,
      address: "123 Main St",
      phone: "+91 9999999999",
      website: "https://testclinic.com",
      website_status: "website",
      social_links: [],
      maps_url: "https://maps.google.com/place/testclinic",
      place_identifier: "0x123:0x456",
      plus_code: "ABC",
      latitude: 20.0,
      longitude: 85.0,
      opening_hours: null,
      business_status: "operational",
      description: null,
      service_options: [],
      attributes: [],
      extraction_status: "complete",
      extraction_timestamp: new Date().toISOString(),
      source_platform: "google_maps",
      duplicate_of: null,
      missing_fields: [],
      error_fields: [],
    });

    const sessionsBefore = await getAllSessions();
    const recordsBefore = await getRecordsBySession("sess-wipe-1");
    expect(sessionsBefore.length).toBe(2);
    expect(recordsBefore.length).toBe(1);

    await clearEntireDatabase();

    const sessionsAfter = await getAllSessions();
    const recordsAfter = await getRecordsBySession("sess-wipe-1");
    expect(sessionsAfter.length).toBe(0);
    expect(recordsAfter.length).toBe(0);
  });
});
