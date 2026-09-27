/**
 * Queue Repository
 * Defined in PRD Section 14 and 26
 */

import { QueueItem } from "../schema/session";
import { getDb } from "./db";

export async function saveQueueItems(items: QueueItem[]): Promise<void> {
  const db = await getDb();
  const tx = db.transaction("queue_items", "readwrite");
  for (const item of items) {
    await tx.store.put(item);
  }
  await tx.done;
}

export async function updateQueueItem(item: QueueItem): Promise<void> {
  const db = await getDb();
  await db.put("queue_items", item);
}

export async function getQueueItemsBySession(sessionId: string): Promise<QueueItem[]> {
  const db = await getDb();
  const index = db.transaction("queue_items", "readonly").store.index("sessionId");
  const items = await index.getAll(IDBKeyRange.only(sessionId));
  return items.sort((a, b) => a.discoveryIndex - b.discoveryIndex);
}
