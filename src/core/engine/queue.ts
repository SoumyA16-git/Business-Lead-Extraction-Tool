/**
 * Queue Management and Lifecycle
 * Defined in PRD Sections 8.2, 8.3, and 14
 */

import { RawCard } from "../schema/business-record";
import { ExtractionSession, QueueItem, SearchContext } from "../schema/session";
import { DEFAULT_EXTRACTION_SETTINGS, ExtractionSettings } from "../../shared/settings";

/**
 * Creates a unique UUID string (works in browser and node environments)
 */
export function generateUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Initializes a new ExtractionSession
 */
export function createExtractionSession(
  sourceUrl: string,
  searchContext: SearchContext,
  platform = "google_maps",
  settings: Partial<ExtractionSettings> = {}
): ExtractionSession {
  const now = new Date().toISOString();
  return {
    sessionId: generateUUID(),
    platform,
    sourceUrl,
    searchContext,
    status: "idle",
    pauseReason: null,
    createdAt: now,
    updatedAt: now,
    queue: [],
    processedCount: 0,
    successCount: 0,
    partialCount: 0,
    failedCount: 0,
    duplicateCount: 0,
    websiteCount: 0,
    socialCount: 0,
    noWebsiteCount: 0,
    settingsSnapshot: { ...DEFAULT_EXTRACTION_SETTINGS, ...settings },
  };
}

/**
 * Ingests newly discovered RawCards into the session queue.
 * Drops cards whose cardFingerprint or cardRef already exists in the queue.
 * Respects maxBusinesses setting if set.
 */
export function enqueueDiscoveredCards(
  session: ExtractionSession,
  discoveredCards: RawCard[]
): { addedCount: number; newQueueItems: QueueItem[] } {
  const existingFingerprints = new Set(session.queue.map((q) => q.cardFingerprint));
  const newQueueItems: QueueItem[] = [];

  const maxAllowed = session.settingsSnapshot.maxBusinesses;

  for (const card of discoveredCards) {
    if (maxAllowed > 0 && session.queue.length >= maxAllowed) {
      break;
    }

    if (existingFingerprints.has(card.cardFingerprint)) {
      continue;
    }

    existingFingerprints.add(card.cardFingerprint);

    const queueItem: QueueItem = {
      queueId: generateUUID(),
      sessionId: session.sessionId,
      discoveryIndex: card.discoveryIndex !== undefined ? card.discoveryIndex : session.queue.length,
      status: "queued",
      cardRef: card.cardRef,
      name: card.name,
      address: card.address,
      phone: card.phone,
      website: card.website,
      rating: card.rating ?? null,
      reviewCount: card.reviewCount ?? null,
      category: card.category,
      recordId: null,
      retryCount: 0,
      lastError: null,
      cardFingerprint: card.cardFingerprint,
    };

    session.queue.push(queueItem);
    newQueueItems.push(queueItem);
  }

  session.updatedAt = new Date().toISOString();
  return { addedCount: newQueueItems.length, newQueueItems };
}

/**
 * Gets the next unprocessed queued item
 */
export function getNextQueuedItem(session: ExtractionSession): QueueItem | null {
  return session.queue.find((item) => item.status === "queued") || null;
}

/**
 * Resets failed items in the queue back to "queued" status for retry
 */
export function resetFailedItemsForRetry(session: ExtractionSession): QueueItem[] {
  const resetItems: QueueItem[] = [];
  for (const item of session.queue) {
    if (item.status === "failed") {
      item.status = "queued";
      item.lastError = null;
      resetItems.push(item);
    }
  }
  session.updatedAt = new Date().toISOString();
  return resetItems;
}
