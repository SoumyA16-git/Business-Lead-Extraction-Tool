/**
 * Sessions Repository
 * Defined in PRD Section 14 and 26
 */

import { ExtractionSession, PauseReason, SessionStatus } from "../schema/session";
import { getDb } from "./db";

export async function saveSession(session: ExtractionSession): Promise<void> {
  const db = await getDb();
  session.updatedAt = new Date().toISOString();
  await db.put("sessions", session);
}

export async function getSession(sessionId: string): Promise<ExtractionSession | undefined> {
  const db = await getDb();
  return db.get("sessions", sessionId);
}

export async function getAllSessions(): Promise<ExtractionSession[]> {
  const db = await getDb();
  const tx = db.transaction("sessions", "readonly");
  const index = tx.store.index("updatedAt");
  const sessions = await index.getAll();
  // Return sorted descending by updatedAt
  return sessions.reverse();
}

export async function updateSessionStatus(
  sessionId: string,
  status: SessionStatus,
  pauseReason: PauseReason = null
): Promise<ExtractionSession | undefined> {
  const db = await getDb();
  const tx = db.transaction("sessions", "readwrite");
  const session = await tx.store.get(sessionId);
  if (!session) {
    await tx.done;
    return undefined;
  }
  session.status = status;
  session.pauseReason = pauseReason;
  session.updatedAt = new Date().toISOString();
  await tx.store.put(session);
  await tx.done;
  return session;
}

export async function deleteSession(sessionId: string): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(["sessions", "queue_items", "business_records"], "readwrite");

  // Delete session
  await tx.objectStore("sessions").delete(sessionId);

  // Delete queue items
  const queueIndex = tx.objectStore("queue_items").index("sessionId");
  let queueCursor = await queueIndex.openKeyCursor(IDBKeyRange.only(sessionId));
  while (queueCursor) {
    await tx.objectStore("queue_items").delete(queueCursor.primaryKey);
    queueCursor = await queueCursor.continue();
  }

  // Delete records
  const recordsIndex = tx.objectStore("business_records").index("sessionId");
  let recordCursor = await recordsIndex.openKeyCursor(IDBKeyRange.only(sessionId));
  while (recordCursor) {
    await tx.objectStore("business_records").delete(recordCursor.primaryKey);
    recordCursor = await recordCursor.continue();
  }

  await tx.done;
}

export async function renameSession(sessionId: string, newName: string): Promise<ExtractionSession | undefined> {
  const db = await getDb();
  const tx = db.transaction("sessions", "readwrite");
  const session = await tx.store.get(sessionId);
  if (!session) {
    await tx.done;
    return undefined;
  }
  session.customName = newName.trim();
  session.updatedAt = new Date().toISOString();
  await tx.store.put(session);
  await tx.done;
  return session;
}

export async function bulkDeleteSessions(sessionIds: string[]): Promise<void> {
  for (const id of sessionIds) {
    await deleteSession(id);
  }
}
