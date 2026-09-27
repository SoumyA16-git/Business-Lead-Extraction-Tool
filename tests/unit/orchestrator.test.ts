import { beforeEach, describe, expect, it, vi } from "vitest";
import { closeDb, getDb } from "../../src/core/storage/db";
import { ExtractionOrchestrator, OrchestratorCallbacks } from "../../src/core/engine/orchestrator";
import { ExtractionSession, QueueItem } from "../../src/core/schema/session";
import { DEFAULT_EXTRACTION_SETTINGS } from "../../src/shared/settings";
import { RawBusinessData, RawCard } from "../../src/core/schema/business-record";
import { saveSession } from "../../src/core/storage/sessions-repo";
import { extractPlaceIdentifier } from "../../src/adapters/google-maps/extractors/place-identifier";

function createMockSession(
  sessionId: string,
  maxBusinesses = 10,
  initialQueue: QueueItem[] = []
): ExtractionSession {
  return {
    sessionId,
    platform: "google_maps",
    sourceUrl: "https://maps.google.com/search/dentists",
    searchContext: { query: "dentists", locationHint: null },
    status: "idle",
    pauseReason: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    queue: initialQueue,
    processedCount: 0,
    successCount: 0,
    partialCount: 0,
    failedCount: 0,
    duplicateCount: 0,
    websiteCount: 0,
    socialCount: 0,
    noWebsiteCount: 0,
    settingsSnapshot: {
      ...DEFAULT_EXTRACTION_SETTINGS,
      maxBusinesses,
      minDelaySeconds: 0,
      maxDelaySeconds: 0,
      maxRetriesPerBusiness: 1,
      maxConsecutiveFailures: 5,
    },
  };
}

function createMockQueueItem(sessionId: string, index: number, name: string): QueueItem {
  return {
    queueId: `q-${sessionId}-${index}`,
    sessionId,
    discoveryIndex: index,
    status: "queued",
    cardRef: `https://maps.google.com/place/${encodeURIComponent(name)}/@20.29,85.82,17z/data=!4m6!3m5!1s0x3a19:0x${index}000!8m2!3d20.29!4d85.82`,
    name,
    category: "Dentist",
    address: `${index} Medical Way`,
    phone: `+91 943700000${index}`,
    rating: 4.5,
    reviewCount: 10 + index,
    recordId: null,
    retryCount: 0,
    lastError: null,
    cardFingerprint: `fp-${sessionId}-${index}`,
  };
}

describe("ExtractionOrchestrator Continuous Discovery & Lifecycle", () => {
  beforeEach(async () => {
    closeDb();
    const db = await getDb();
    await db.clear("sessions");
    await db.clear("queue_items");
    await db.clear("business_records");
    await db.clear("settings");
  });

  it("processes initial queue and dynamically discovers more cards when pending count is low", async () => {
    const session = createMockSession("sess-dyn-1", 5, [
      createMockQueueItem("sess-dyn-1", 1, "Clinic 1"),
      createMockQueueItem("sess-dyn-1", 2, "Clinic 2"),
    ]);
    await saveSession(session);

    let scrollCalls = 0;
    const callbacks: OrchestratorCallbacks = {
      sendToContent: vi.fn(async (msg: any) => {
        if (msg.type === "SCROLL_RESULTS_FEED") {
          scrollCalls++;
          if (scrollCalls === 1) {
            const newCards: RawCard[] = [
              {
                name: "Clinic 3",
                cardRef: "https://maps.google.com/place/Clinic3/@20.29,85.82,17z/data=!4m6!3m5!1s0x3a19:0x3000!8m2!3d20.29!4d85.82",
                category: "Dentist",
                cardFingerprint: "fp-dyn-3",
                discoveryIndex: 3,
              },
              {
                name: "Clinic 4",
                cardRef: "https://maps.google.com/place/Clinic4/@20.29,85.82,17z/data=!4m6!3m5!1s0x3a19:0x4000!8m2!3d20.29!4d85.82",
                category: "Dentist",
                cardFingerprint: "fp-dyn-4",
                discoveryIndex: 4,
              },
              {
                name: "Clinic 5",
                cardRef: "https://maps.google.com/place/Clinic5/@20.29,85.82,17z/data=!4m6!3m5!1s0x3a19:0x5000!8m2!3d20.29!4d85.82",
                category: "Dentist",
                cardFingerprint: "fp-dyn-5",
                discoveryIndex: 5,
              },
            ];
            return { cards: newCards };
          }
          return { cards: [] };
        }
        return {};
      }),
      broadcastToUI: vi.fn(),
      requestRawExtraction: vi.fn(async (item: QueueItem): Promise<RawBusinessData> => {
        return {
          name: item.name,
          primaryCategory: "Dentist",
          secondaryCategories: [],
          rating: 4.8,
          reviewCount: 25,
          priceLevel: null,
          address: "Bhubaneswar",
          phone: `+91 98765 4321${item.discoveryIndex}`,
          websiteUrl: "https://example.com",
          socialUrls: [],
          mapsUrl: item.cardRef,
          placeIdentifier: extractPlaceIdentifier(item.cardRef) || ("0x3a19:0x" + item.discoveryIndex + "000"),
          plusCode: null,
          coordinates: { lat: 20.29, lng: 85.82 },
          hours: null,
          businessStatus: "operational",
          description: null,
          serviceOptions: [],
          attributes: [],
        };
      }),
    };

    const orchestrator = new ExtractionOrchestrator(session, callbacks);
    await orchestrator.start();
    await orchestrator.waitForCompletion();

    // Verify session completed exactly when maxBusinesses (5) reached
    const finalSession = orchestrator.getSession();
    expect(finalSession.status).toBe("completed");
    expect(finalSession.processedCount).toBe(5);
    expect(finalSession.successCount).toBe(5);
    expect(scrollCalls).toBeGreaterThanOrEqual(1);
  });

  it("does not complete when queue is temporarily empty; recovers via scrolling and completes at limit", async () => {
    // Initial queue is empty, limit is 4
    const session = createMockSession("sess-temp-empty", 4, []);
    await saveSession(session);

    let scrollAttempts = 0;
    const callbacks: OrchestratorCallbacks = {
      sendToContent: vi.fn(async (msg: any) => {
        if (msg.type === "SCROLL_RESULTS_FEED") {
          scrollAttempts++;
          // First 2 calls return nothing, 3rd call returns batch of 2 new cards
          if (scrollAttempts === 3) {
            return {
              cards: [
                {
                  name: "Gamma Dental",
                  cardRef: "https://maps.google.com/place/Gamma/@20.29,85.82,17z/data=!4m6!3m5!1s0x3a19:0x3333!8m2!3d20.29!4d85.82",
                  category: "Dentist",
                  cardFingerprint: "fp-gamma",
                },
                {
                  name: "Delta Dental",
                  cardRef: "https://maps.google.com/place/Delta/@20.29,85.82,17z/data=!4m6!3m5!1s0x3a19:0x4444!8m2!3d20.29!4d85.82",
                  category: "Dentist",
                  cardFingerprint: "fp-delta",
                },
              ],
            };
          }
          // Next scroll returns another batch of 2 cards
          if (scrollAttempts === 5) {
            return {
              cards: [
                {
                  name: "Epsilon Dental",
                  cardRef: "https://maps.google.com/place/Epsilon/@20.29,85.82,17z/data=!4m6!3m5!1s0x3a19:0x5555!8m2!3d20.29!4d85.82",
                  category: "Dentist",
                  cardFingerprint: "fp-epsilon",
                },
                {
                  name: "Zeta Dental",
                  cardRef: "https://maps.google.com/place/Zeta/@20.29,85.82,17z/data=!4m6!3m5!1s0x3a19:0x6666!8m2!3d20.29!4d85.82",
                  category: "Dentist",
                  cardFingerprint: "fp-zeta",
                },
              ],
            };
          }
          return { cards: [] };
        }
        return {};
      }),
      broadcastToUI: vi.fn(),
      requestRawExtraction: vi.fn(async (item: QueueItem): Promise<RawBusinessData> => {
        return {
          name: item.name,
          primaryCategory: "Dentist",
          secondaryCategories: [],
          rating: 4.6,
          reviewCount: 15,
          priceLevel: null,
          address: "Sample St",
          phone: "+91 99999 88888",
          websiteUrl: "https://example.com",
          socialUrls: [],
          mapsUrl: item.cardRef,
          placeIdentifier: extractPlaceIdentifier(item.cardRef),
          plusCode: null,
          coordinates: { lat: 20.29, lng: 85.82 },
          hours: null,
          businessStatus: "operational",
          description: null,
          serviceOptions: [],
          attributes: [],
        };
      }),
    };

    const orchestrator = new ExtractionOrchestrator(session, callbacks);
    await orchestrator.start();
    await orchestrator.waitForCompletion();

    const finalSession = orchestrator.getSession();
    expect(finalSession.status).toBe("completed");
    expect(finalSession.processedCount).toBe(4);
    expect(finalSession.successCount).toBe(4);
  });

  it("stops exactly when configured limit is reached and does not process excess queued items", async () => {
    // Initial queue has 5 items, but limit is configured to 2
    const session = createMockSession("sess-limit-exact", 2, [
      createMockQueueItem("sess-limit-exact", 1, "Item 1"),
      createMockQueueItem("sess-limit-exact", 2, "Item 2"),
      createMockQueueItem("sess-limit-exact", 3, "Item 3"),
      createMockQueueItem("sess-limit-exact", 4, "Item 4"),
      createMockQueueItem("sess-limit-exact", 5, "Item 5"),
    ]);
    await saveSession(session);

    let processedCount = 0;
    const callbacks: OrchestratorCallbacks = {
      sendToContent: vi.fn(async () => ({ cards: [] })),
      broadcastToUI: vi.fn(),
      requestRawExtraction: vi.fn(async (item: QueueItem): Promise<RawBusinessData> => {
        processedCount++;
        return {
          name: item.name,
          primaryCategory: "Dentist",
          secondaryCategories: [],
          rating: 4.0,
          reviewCount: 5,
          priceLevel: null,
          address: "Test",
          phone: null,
          websiteUrl: null,
          socialUrls: [],
          mapsUrl: item.cardRef,
          placeIdentifier: "0x3a19:0x" + item.discoveryIndex,
          plusCode: null,
          coordinates: { lat: 20.29, lng: 85.82 },
          hours: null,
          businessStatus: "operational",
          description: null,
          serviceOptions: [],
          attributes: [],
        };
      }),
    };

    const orchestrator = new ExtractionOrchestrator(session, callbacks);
    await orchestrator.start();
    await orchestrator.waitForCompletion();

    const finalSession = orchestrator.getSession();
    expect(finalSession.status).toBe("completed");
    expect(finalSession.processedCount).toBe(2);
    expect(processedCount).toBe(2);
  });

  it("handles a single business failure without terminating the entire session", async () => {
    const session = createMockSession("sess-failure-continue", 3, [
      createMockQueueItem("sess-failure-continue", 1, "Good Clinic 1"),
      createMockQueueItem("sess-failure-continue", 2, "Bad Clinic 2"),
      createMockQueueItem("sess-failure-continue", 3, "Good Clinic 3"),
    ]);
    await saveSession(session);

    const callbacks: OrchestratorCallbacks = {
      sendToContent: vi.fn(async () => ({ cards: [] })),
      broadcastToUI: vi.fn(),
      requestRawExtraction: vi.fn(async (item: QueueItem): Promise<RawBusinessData> => {
        if (item.name === "Bad Clinic 2") {
          throw new Error("Target card not found in DOM");
        }
        return {
          name: item.name,
          primaryCategory: "Dentist",
          secondaryCategories: [],
          rating: 4.5,
          reviewCount: 20,
          priceLevel: null,
          address: "Valid Address",
          phone: "+91 9990001112",
          websiteUrl: "https://goodclinic.com",
          socialUrls: [],
          mapsUrl: item.cardRef,
          placeIdentifier: "0x3a19:0x" + item.discoveryIndex,
          plusCode: null,
          coordinates: { lat: 20.29, lng: 85.82 },
          hours: null,
          businessStatus: "operational",
          description: null,
          serviceOptions: [],
          attributes: [],
        };
      }),
    };

    const orchestrator = new ExtractionOrchestrator(session, callbacks);
    await orchestrator.start();
    await orchestrator.waitForCompletion();

    const finalSession = orchestrator.getSession();
    expect(finalSession.status).toBe("completed");
    expect(finalSession.processedCount).toBe(3);
    expect(finalSession.successCount).toBe(2);
    expect(finalSession.failedCount).toBe(1);

    const failedItem = finalSession.queue.find((i) => i.name === "Bad Clinic 2");
    expect(failedItem?.status).toBe("failed");
  });

  it("detects genuine result exhaustion after 8 consecutive empty scroll attempts", async () => {
    const session = createMockSession("sess-exhausted", 100, [
      createMockQueueItem("sess-exhausted", 1, "Only Clinic"),
    ]);
    await saveSession(session);

    let scrollCalls = 0;
    const callbacks: OrchestratorCallbacks = {
      sendToContent: vi.fn(async (msg: any) => {
        if (msg.type === "SCROLL_RESULTS_FEED") {
          scrollCalls++;
          return { cards: [] }; // never finds any new cards
        }
        return {};
      }),
      broadcastToUI: vi.fn(),
      requestRawExtraction: vi.fn(async (item: QueueItem): Promise<RawBusinessData> => {
        return {
          name: item.name,
          primaryCategory: "Dentist",
          secondaryCategories: [],
          rating: 4.0,
          reviewCount: 1,
          priceLevel: null,
          address: "Isolated",
          phone: null,
          websiteUrl: null,
          socialUrls: [],
          mapsUrl: item.cardRef,
          placeIdentifier: "0x3a19:0x1",
          plusCode: null,
          coordinates: { lat: 20.0, lng: 85.0 },
          hours: null,
          businessStatus: "operational",
          description: null,
          serviceOptions: [],
          attributes: [],
        };
      }),
    };

    const orchestrator = new ExtractionOrchestrator(session, callbacks);
    await orchestrator.start();
    await orchestrator.waitForCompletion();

    const finalSession = orchestrator.getSession();
    expect(finalSession.status).toBe("completed");
    expect(finalSession.processedCount).toBe(1);
    expect(finalSession.completionReason).toBe("results_exhausted");
    expect(scrollCalls).toBeGreaterThanOrEqual(8);
  });

  it("does not complete on 8 initial items when limit is 620; scrolls and extracts subsequent batch", async () => {
    // Exactly replicating the initial 8-business scenario with limit 620
    const initial8 = Array.from({ length: 8 }, (_, i) =>
      createMockQueueItem("sess-init8", i + 1, `Initial Clinic ${i + 1}`)
    );
    const session = createMockSession("sess-init8", 620, initial8);
    await saveSession(session);

    let scrollCount = 0;
    const callbacks: OrchestratorCallbacks = {
      sendToContent: vi.fn(async (msg: any) => {
        if (msg.type === "SCROLL_RESULTS_FEED") {
          scrollCount++;
          // On scroll, return 4 more businesses
          if (scrollCount === 1) {
            return {
              cards: [
                {
                  name: "Next Clinic 9",
                  cardRef: "https://maps.google.com/place/Next9/@20.29,85.82,17z/data=!4m6!3m5!1s0x3a19:0x9000!8m2!3d20.29!4d85.82",
                  category: "Dentist",
                  cardFingerprint: "fp-next-9",
                  discoveryIndex: 9,
                },
                {
                  name: "Next Clinic 10",
                  cardRef: "https://maps.google.com/place/Next10/@20.29,85.82,17z/data=!4m6!3m5!1s0x3a19:0xa000!8m2!3d20.29!4d85.82",
                  category: "Dentist",
                  cardFingerprint: "fp-next-10",
                  discoveryIndex: 10,
                },
              ],
            };
          }
          return { cards: [] };
        }
        return {};
      }),
      broadcastToUI: vi.fn(),
      requestRawExtraction: vi.fn(async (item: QueueItem): Promise<RawBusinessData> => {
        return {
          name: item.name,
          primaryCategory: "Dentist",
          secondaryCategories: [],
          rating: 4.5,
          reviewCount: 10,
          priceLevel: null,
          address: "Paharganj, New Delhi",
          phone: "+91 11 2345 6789",
          websiteUrl: "https://clinic.example.com",
          socialUrls: [],
          mapsUrl: item.cardRef,
          placeIdentifier: extractPlaceIdentifier(item.cardRef) || ("0x3a19:0x" + item.discoveryIndex + "000"),
          plusCode: null,
          coordinates: { lat: 28.64, lng: 77.21 },
          hours: null,
          businessStatus: "operational",
          description: null,
          serviceOptions: [],
          attributes: [],
        };
      }),
    };

    const orchestrator = new ExtractionOrchestrator(session, callbacks);
    await orchestrator.start();
    await orchestrator.waitForCompletion();

    const finalSession = orchestrator.getSession();
    expect(finalSession.status).toBe("completed");
    expect(finalSession.completionReason).toBe("results_exhausted");
    // All 8 initial + 2 new cards extracted (total 10)
    expect(finalSession.processedCount).toBe(10);
    expect(finalSession.successCount).toBe(10);
    expect(finalSession.partialCount).toBe(0);
    expect(finalSession.failedCount).toBe(0);
    expect(scrollCount).toBeGreaterThanOrEqual(1);
  });

  it("strictly rejects empty raw extraction without counting it as Partial or Success", async () => {
    const session = createMockSession("sess-zero-data", 5, [
      createMockQueueItem("sess-zero-data", 1, "Zero Data Clinic"),
    ]);
    await saveSession(session);

    const callbacks: OrchestratorCallbacks = {
      sendToContent: vi.fn(async () => ({ cards: [] })),
      broadcastToUI: vi.fn(),
      requestRawExtraction: vi.fn(async (): Promise<RawBusinessData> => {
        // Content script returns empty object with no valid business name
        throw new Error("Empty raw extraction received from target detail panel");
      }),
    };

    const orchestrator = new ExtractionOrchestrator(session, callbacks);
    await orchestrator.start();
    await orchestrator.waitForCompletion();

    const finalSession = orchestrator.getSession();
    expect(finalSession.status).toBe("completed");
    expect(finalSession.processedCount).toBe(1);
    expect(finalSession.successCount).toBe(0);
    expect(finalSession.partialCount).toBe(0);
    expect(finalSession.failedCount).toBe(1);

    const failedItem = finalSession.queue.find((i) => i.name === "Zero Data Clinic");
    expect(failedItem?.status).toBe("failed");
    expect(failedItem?.lastError).toContain("Empty raw extraction");
  });
});
