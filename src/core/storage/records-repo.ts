/**
 * Business Records Repository with Atomic Transitions and Indexed Dedup Lookups
 * Defined in PRD Section 26.2
 */

import { computeRecordFingerprints, isDuplicate } from "../dedup/identifier-chain";
import { mergeDuplicateRecord } from "../dedup/merge";
import { BusinessRecord } from "../schema/business-record";
import { ExtractionSession, QueueItem } from "../schema/session";
import { getDb, StoredRecord } from "./db";

export async function saveRecord(sessionId: string, record: BusinessRecord): Promise<void> {
  const db = await getDb();
  const fingerprints = computeRecordFingerprints(record);
  const stored: StoredRecord = {
    ...record,
    sessionId,
    normalizedNameAddress: fingerprints.nameAddressKey || "",
    normalizedNamePhone: fingerprints.namePhoneKey || "",
  };
  await db.put("business_records", stored);
}

export async function getRecord(recordId: string): Promise<StoredRecord | undefined> {
  const db = await getDb();
  return db.get("business_records", recordId);
}

export async function getRecordsBySession(sessionId: string): Promise<StoredRecord[]> {
  const db = await getDb();
  const index = db.transaction("business_records", "readonly").store.index("sessionId");
  return index.getAll(IDBKeyRange.only(sessionId));
}

/**
 * Searches for an existing duplicate using indexed lookups.
 * Supports both "all_sessions" (global) and "current_session" scope.
 */
export async function findExistingDuplicate(
  sessionId: string,
  candidate: Partial<BusinessRecord>,
  scope: "all_sessions" | "current_session" = "all_sessions"
): Promise<StoredRecord | null> {
  const db = await getDb();
  const tx = db.transaction("business_records", "readonly");
  const store = tx.store;

  const fingerprints = computeRecordFingerprints(candidate);

  // 1. Check placeIdentifier index (strongest platform identifier)
  if (fingerprints.placeIdentifier) {
    const placeIdx = store.index("placeIdentifier");
    const matches = await placeIdx.getAll(IDBKeyRange.only(fingerprints.placeIdentifier));
    // Check current session first
    const currentMatch = matches.find((m) => m.sessionId === sessionId);
    if (currentMatch) return currentMatch;

    // Cross-session check if scope allows
    if (scope === "all_sessions") {
      const anyPrimaryMatch = matches.find((m) => m.extraction_status !== "duplicate");
      if (anyPrimaryMatch) return anyPrimaryMatch;
      if (matches.length > 0) return matches[0];
    }
  }

  // 2. Check normalizedNameAddress index
  if (fingerprints.nameAddressKey) {
    const addrIdx = store.index("normalizedNameAddress");
    const matches = await addrIdx.getAll(IDBKeyRange.only(fingerprints.nameAddressKey));
    const currentMatch = matches.find((m) => m.sessionId === sessionId && isDuplicate(candidate, m));
    if (currentMatch) return currentMatch;

    if (scope === "all_sessions") {
      const anyMatch = matches.find((m) => isDuplicate(candidate, m));
      if (anyMatch) return anyMatch;
    }
  }

  // 3. Check normalizedNamePhone index
  if (fingerprints.namePhoneKey) {
    const phoneIdx = store.index("normalizedNamePhone");
    const matches = await phoneIdx.getAll(IDBKeyRange.only(fingerprints.namePhoneKey));
    const currentMatch = matches.find((m) => m.sessionId === sessionId && isDuplicate(candidate, m));
    if (currentMatch) return currentMatch;

    if (scope === "all_sessions") {
      const anyMatch = matches.find((m) => isDuplicate(candidate, m));
      if (anyMatch) return anyMatch;
    }
  }

  // 4. Fallback check for canonical Maps URL or Website
  if (fingerprints.normalizedWebsite || fingerprints.normalizedMapsUrl) {
    if (scope === "current_session") {
      const sessionIdx = store.index("sessionId");
      const sessionRecords = await sessionIdx.getAll(IDBKeyRange.only(sessionId));
      for (const existing of sessionRecords) {
        if (isDuplicate(candidate, existing)) {
          return existing;
        }
      }
    } else {
      const allRecords = await store.getAll();
      for (const existing of allRecords) {
        if (isDuplicate(candidate, existing)) {
          return existing;
        }
      }
    }
  }

  return null;
}

export interface ProcessBusinessTransactionResult {
  savedRecord: BusinessRecord;
  isDuplicateRecord: boolean;
  updatedSession: ExtractionSession;
}

/**
 * Single atomic IndexedDB transaction covering:
 * - Insert or merge into business_records
 * - Update status in queue_items
 * - Update counters in sessions
 * Defined in PRD Section 26.2
 */
export async function saveProcessedBusinessTransaction(
  session: ExtractionSession,
  queueItem: QueueItem,
  extractedRecord: BusinessRecord
): Promise<ProcessBusinessTransactionResult> {
  const scope = session.settingsSnapshot.duplicateScope ?? "all_sessions";

  // Check duplicate before starting the write transaction
  const existingDup = await findExistingDuplicate(session.sessionId, extractedRecord, scope);

  const db = await getDb();
  const tx = db.transaction(["business_records", "queue_items", "sessions"], "readwrite");

  const recordsStore = tx.objectStore("business_records");
  const queueStore = tx.objectStore("queue_items");
  const sessionStore = tx.objectStore("sessions");

  let finalRecord: BusinessRecord;
  let isDup = false;

  if (existingDup) {
    isDup = true;
    const isSameSession = existingDup.sessionId === session.sessionId;

    if (isSameSession && session.settingsSnapshot.duplicateMergePolicy === "fill_gaps") {
      finalRecord = mergeDuplicateRecord(existingDup, extractedRecord);
      const fingerprints = computeRecordFingerprints(finalRecord);
      const stored: StoredRecord = {
        ...finalRecord,
        sessionId: session.sessionId,
        normalizedNameAddress: fingerprints.nameAddressKey || "",
        normalizedNamePhone: fingerprints.namePhoneKey || "",
      };
      await recordsStore.put(stored);
    } else {
      finalRecord = extractedRecord;
    }

    // Store shadow duplicate record in the current session
    const fingerprints = computeRecordFingerprints(extractedRecord);
    const shadowRecord: StoredRecord = {
      ...extractedRecord,
      record_id: extractedRecord.record_id,
      sessionId: session.sessionId,
      extraction_status: "duplicate",
      duplicate_of: existingDup.record_id,
      normalizedNameAddress: fingerprints.nameAddressKey || "",
      normalizedNamePhone: fingerprints.namePhoneKey || "",
    };
    await recordsStore.put(shadowRecord);

    queueItem.status = "duplicate";
    queueItem.recordId = existingDup.record_id;
    session.duplicateCount += 1;
    if (!isSameSession || session.settingsSnapshot.duplicateMergePolicy !== "fill_gaps") {
      finalRecord = shadowRecord;
    }
  } else {
    // New primary record
    finalRecord = extractedRecord;
    const fingerprints = computeRecordFingerprints(finalRecord);
    const stored: StoredRecord = {
      ...finalRecord,
      sessionId: session.sessionId,
      normalizedNameAddress: fingerprints.nameAddressKey || "",
      normalizedNamePhone: fingerprints.namePhoneKey || "",
    };
    await recordsStore.put(stored);

    queueItem.status = finalRecord.extraction_status;
    queueItem.recordId = finalRecord.record_id;

    if (finalRecord.extraction_status === "complete") {
      session.successCount += 1;
    } else if (finalRecord.extraction_status === "partial") {
      session.partialCount += 1;
    } else if (finalRecord.extraction_status === "failed") {
      session.failedCount += 1;
    }

    if (finalRecord.website_status === "website") {
      session.websiteCount += 1;
    } else if (finalRecord.website_status === "social_only") {
      session.socialCount += 1;
    } else {
      session.noWebsiteCount += 1;
    }
  }

  session.processedCount += 1;
  session.updatedAt = new Date().toISOString();

  // Update in-memory session queue reference
  const queueIndexInSession = session.queue.findIndex((q) => q.queueId === queueItem.queueId);
  if (queueIndexInSession >= 0) {
    session.queue[queueIndexInSession] = { ...queueItem };
  }

  await queueStore.put(queueItem);
  await sessionStore.put(session);

  await tx.done;

  return {
    savedRecord: finalRecord,
    isDuplicateRecord: isDup,
    updatedSession: session,
  };
}
