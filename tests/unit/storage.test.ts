import { beforeEach, describe, expect, it } from "vitest";
import { closeDb, getDb } from "../../src/core/storage/db";
import {
  getRecordsBySession,
  saveProcessedBusinessTransaction,
  saveRecord,
} from "../../src/core/storage/records-repo";
import { getSession, saveSession } from "../../src/core/storage/sessions-repo";
import { BusinessRecord } from "../../src/core/schema/business-record";
import { ExtractionSession, QueueItem } from "../../src/core/schema/session";
import { DEFAULT_EXTRACTION_SETTINGS } from "../../src/shared/settings";

function createMockSession(sessionId: string): ExtractionSession {
  return {
    sessionId,
    platform: "google_maps",
    sourceUrl: "https://maps.google.com",
    searchContext: { query: "dental clinics", locationHint: null },
    status: "running",
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

function createMockRecord(recordId: string, overrides: Partial<BusinessRecord> = {}): BusinessRecord {
  return {
    record_id: recordId,
    business_name: "Smile Hub",
    primary_category: "Dentist",
    secondary_categories: [],
    rating: 4.7,
    review_count: 88,
    price_level: null,
    address: "Saheed Nagar, Bhubaneswar",
    phone: "+91 9437000000",
    website: "https://smilehub.com",
    website_status: "website",
    social_links: [],
    maps_url: "https://maps.google.com/place/smilehub",
    place_identifier: "0x3a19:0x8888",
    plus_code: "7MJP+3C",
    latitude: 20.29,
    longitude: 85.84,
    opening_hours: null,
    business_status: "operational",
    description: null,
    service_options: [],
    attributes: [],
    extraction_status: "complete",
    extraction_timestamp: new Date().toISOString(),
    missing_fields: [],
    error_fields: [],
    source_platform: "google_maps",
    duplicate_of: null,
    ...overrides,
  };
}

describe("IndexedDB Storage Layer (PRD Section 26)", () => {
  beforeEach(async () => {
    closeDb();
    const db = await getDb();
    await db.clear("sessions");
    await db.clear("queue_items");
    await db.clear("business_records");
  });

  it("persists and retrieves an extraction session", async () => {
    const session = createMockSession("session-abc");
    await saveSession(session);

    const retrieved = await getSession("session-abc");
    expect(retrieved).toBeDefined();
    expect(retrieved?.sessionId).toBe("session-abc");
    expect(retrieved?.searchContext.query).toBe("dental clinics");
  });

  it("persists records and retrieves by session id", async () => {
    const record = createMockRecord("rec-1");
    await saveRecord("session-abc", record);

    const sessionRecords = await getRecordsBySession("session-abc");
    expect(sessionRecords.length).toBe(1);
    expect(sessionRecords[0].business_name).toBe("Smile Hub");
  });

  it("executes atomic business processing transaction with deduplication", async () => {
    const session = createMockSession("session-tx");
    await saveSession(session);

    const queueItem1: QueueItem = {
      queueId: "q-1",
      sessionId: "session-tx",
      discoveryIndex: 1,
      status: "processing",
      cardRef: "card-1",
      name: "Smile Hub",
      recordId: null,
      retryCount: 0,
      lastError: null,
      cardFingerprint: "fingerprint-1",
    };
    session.queue.push(queueItem1);

    const record1 = createMockRecord("rec-tx-1", {
      place_identifier: "0x999:0x888",
      phone: "", // gap
    });

    const res1 = await saveProcessedBusinessTransaction(session, queueItem1, record1);
    expect(res1.isDuplicateRecord).toBe(false);
    expect(res1.updatedSession.successCount).toBe(1);
    expect(res1.updatedSession.processedCount).toBe(1);

    // Process duplicate business
    const queueItem2: QueueItem = {
      queueId: "q-2",
      sessionId: "session-tx",
      discoveryIndex: 2,
      status: "processing",
      cardRef: "card-2",
      name: "Smile Hub Duplicate Listing",
      recordId: null,
      retryCount: 0,
      lastError: null,
      cardFingerprint: "fingerprint-2",
    };
    session.queue.push(queueItem2);

    const record2 = createMockRecord("rec-tx-2", {
      place_identifier: "0x999:0x888", // Same place identifier!
      phone: "+91 9998887776", // gap filled
    });

    const res2 = await saveProcessedBusinessTransaction(session, queueItem2, record2);
    expect(res2.isDuplicateRecord).toBe(true);
    expect(res2.updatedSession.duplicateCount).toBe(1);
    // Gap phone was filled in merged record
    expect(res2.savedRecord.phone).toBe("+91 9998887776");
  });

  it("detects duplicates across multiple sessions while keeping original older record intact", async () => {
    // 1. First session with a saved lead
    const session1 = createMockSession("session-1");
    await saveSession(session1);

    const queueItem1: QueueItem = {
      queueId: "q-sess1-1",
      sessionId: "session-1",
      discoveryIndex: 1,
      status: "processing",
      cardRef: "card-s1",
      name: "City Dental Odisha",
      recordId: null,
      retryCount: 0,
      lastError: null,
      cardFingerprint: "fp-1",
    };
    session1.queue.push(queueItem1);

    const record1 = createMockRecord("rec-session1-lead", {
      business_name: "City Dental Odisha",
      place_identifier: "0xAAA:0xBBB",
      phone: "+91 99370 12345",
      maps_url: "https://www.google.com/maps/place/City+Dental+Odisha",
    });

    const res1 = await saveProcessedBusinessTransaction(session1, queueItem1, record1);
    expect(res1.isDuplicateRecord).toBe(false);
    expect(res1.updatedSession.successCount).toBe(1);

    // 2. Second session (different session ID with all_sessions global duplicate scope configured)
    const session2 = createMockSession("session-2");
    session2.settingsSnapshot.duplicateScope = "all_sessions";
    await saveSession(session2);

    const queueItem2: QueueItem = {
      queueId: "q-sess2-1",
      sessionId: "session-2",
      discoveryIndex: 1,
      status: "processing",
      cardRef: "card-s2",
      name: "City Dental Odisha (Different query)",
      recordId: null,
      retryCount: 0,
      lastError: null,
      cardFingerprint: "fp-2",
    };
    session2.queue.push(queueItem2);

    const record2 = createMockRecord("rec-session2-lead", {
      business_name: "City Dental Odisha",
      place_identifier: "0xAAA:0xBBB", // Identical place identifier from Maps URL
      phone: "+91 99370 12345",
      maps_url: "https://www.google.com/maps/place/City+Dental+Odisha",
    });

    const res2 = await saveProcessedBusinessTransaction(session2, queueItem2, record2);

    // Cross-session duplicate should be detected!
    expect(res2.isDuplicateRecord).toBe(true);
    expect(res2.updatedSession.duplicateCount).toBe(1);
    expect(queueItem2.status).toBe("duplicate");
    expect(queueItem2.recordId).toBe("rec-session1-lead");

    // Shadow duplicate record created in session 2 linked to session 1
    expect(res2.savedRecord.extraction_status).toBe("duplicate");
    expect(res2.savedRecord.duplicate_of).toBe("rec-session1-lead");

    // Verify session 1's original record remains intact
    const s1Records = await getRecordsBySession("session-1");
    const originalInS1 = s1Records.find((r) => r.record_id === "rec-session1-lead");
    expect(originalInS1).toBeDefined();
    expect(originalInS1?.extraction_status).toBe("complete");
  });

  it("clearEntireDatabase wipes data stores but strictly preserves settings", async () => {
    const db = await getDb();
    const session = createMockSession("session-to-clear");
    await saveSession(session);
    await saveRecord("session-to-clear", createMockRecord("rec-to-clear"));

    // Save a setting
    await db.put("settings", { key: "extractionSettings", value: { maxBusinesses: 500 } });

    const { clearEntireDatabase } = await import("../../src/core/storage/db");
    await clearEntireDatabase();

    const clearedSessions = await db.getAll("sessions");
    const clearedRecords = await db.getAll("business_records");
    const preservedSettings = await db.get("settings", "extractionSettings");

    expect(clearedSessions.length).toBe(0);
    expect(clearedRecords.length).toBe(0);
    expect(preservedSettings).toBeDefined();
    expect((preservedSettings?.value as any)?.maxBusinesses).toBe(500);
  });

  it("updating settings persists cleanly without altering or clearing existing session records", async () => {
    const db = await getDb();
    const session = createMockSession("session-settings-test");
    await saveSession(session);
    await saveRecord("session-settings-test", createMockRecord("rec-settings-test"));

    // Save/update settings
    await db.put("settings", {
      key: "extractionSettings",
      value: { ...DEFAULT_EXTRACTION_SETTINGS, maxBusinesses: 1000, minDelaySeconds: 3.0 },
    });

    const sessions = await db.getAll("sessions");
    const records = await db.getAll("business_records");
    const updatedSettings = await db.get("settings", "extractionSettings");

    expect(sessions.length).toBe(1);
    expect(records.length).toBe(1);
    expect(records[0].record_id).toBe("rec-settings-test");
    expect((updatedSettings?.value as any)?.maxBusinesses).toBe(1000);
  });
});
