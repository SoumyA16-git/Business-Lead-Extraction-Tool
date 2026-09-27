/**
 * Extraction Orchestration Engine
 * Defined in PRD Sections 16, 22, and 24
 */

import { GoogleMapsAdapter } from "../../adapters/google-maps";
import {
  extractCoordinates,
  extractPlaceIdentifier,
} from "../../adapters/google-maps/extractors/place-identifier";
import { getJitteredDelayMs, getExponentialBackoffMs, delayMs } from "../../utils/time";
import { BusinessRecord, RawBusinessData, RawCard } from "../schema/business-record";
import { ExtractionSession, PauseReason, QueueItem } from "../schema/session";
import { applySessionAction } from "./state-machine";
import {
  enqueueDiscoveredCards,
  generateUUID,
  getNextQueuedItem,
  resetFailedItemsForRetry,
} from "./queue";
import { saveSession } from "../storage/sessions-repo";
import { saveProcessedBusinessTransaction } from "../storage/records-repo";
import { computeMissingFields } from "../missing-data/compute-missing";

export interface OrchestratorCallbacks {
  sendToContent: (message: unknown) => Promise<unknown>;
  broadcastToUI: (message: unknown) => void;
  requestRawExtraction: (queueItem: QueueItem) => Promise<RawBusinessData>;
}

export class ExtractionOrchestrator {
  private session: ExtractionSession;
  private adapter = new GoogleMapsAdapter();
  private callbacks: OrchestratorCallbacks;
  private isLoopRunning = false;
  private consecutiveFailures = 0;
  private loopPromise: Promise<void> | null = null;

  constructor(session: ExtractionSession, callbacks: OrchestratorCallbacks) {
    this.session = session;
    this.callbacks = callbacks;
  }

  public getSession(): ExtractionSession {
    return this.session;
  }

  public setSession(session: ExtractionSession): void {
    this.session = session;
  }

  /**
   * Starts extraction loop
   */
  public async start(): Promise<void> {
    if (this.session.status === "running") return;
    this.session = applySessionAction(this.session, { type: "START" });
    await saveSession(this.session);
    this.callbacks.broadcastToUI({ type: "SESSION_UPDATED", session: this.session });
    this.loopPromise = this.runLoop();
  }

  /**
   * Waits for the currently running extraction loop to finish or pause
   */
  public async waitForCompletion(): Promise<ExtractionSession> {
    if (this.loopPromise) {
      await this.loopPromise;
    }
    return this.session;
  }

  /**
   * Pauses extraction loop
   */
  public async pause(reason: PauseReason = "user"): Promise<void> {
    this.session = applySessionAction(this.session, { type: "PAUSE", reason });
    await saveSession(this.session);
    this.callbacks.broadcastToUI({ type: "SESSION_UPDATED", session: this.session });
  }

  /**
   * Resumes extraction loop
   */
  public async resume(): Promise<void> {
    if (this.session.status === "running") return;
    this.session = applySessionAction(this.session, { type: "RESUME" });
    this.consecutiveFailures = 0;
    await saveSession(this.session);
    this.callbacks.broadcastToUI({ type: "SESSION_UPDATED", session: this.session });
    this.loopPromise = this.runLoop();
  }

  /**
   * Stops extraction permanently, preserving all saved records
   */
  public async stop(): Promise<void> {
    this.session = applySessionAction(this.session, { type: "STOP" });
    await saveSession(this.session);
    this.callbacks.broadcastToUI({ type: "SESSION_UPDATED", session: this.session });
  }

  /**
   * Resets only failed items and resumes extraction
   */
  public async retryFailed(): Promise<void> {
    resetFailedItemsForRetry(this.session);
    await saveSession(this.session);
    this.callbacks.broadcastToUI({ type: "SESSION_UPDATED", session: this.session });
    await this.resume();
  }

  /**
   * Main sequential processing loop
   */
  private async runLoop(): Promise<void> {
    if (this.isLoopRunning) return;
    this.isLoopRunning = true;

    try {
      while (this.session.status === "running") {
        const limit = this.session.settingsSnapshot.maxBusinesses;

        // Check if session maxBusinesses limit has been reached
        if (limit > 0 && this.session.processedCount >= limit) {
          this.session = applySessionAction(this.session, {
            type: "COMPLETE",
            reason: "limit_reached",
          });
          await saveSession(this.session);
          this.callbacks.broadcastToUI({ type: "SESSION_UPDATED", session: this.session });
          break;
        }

        // Proactively scroll feed when pending items are low (< 10) and limit is not yet fulfilled
        const pendingCount = this.session.queue.filter((i) => i.status === "queued").length;
        if (pendingCount < 10 && (limit <= 0 || this.session.processedCount + pendingCount < limit)) {
          try {
            const scrollRes = (await this.callbacks.sendToContent({
              type: "SCROLL_RESULTS_FEED",
            })) as { cards?: RawCard[] } | undefined;

            if (scrollRes?.cards && scrollRes.cards.length > 0) {
              const { addedCount } = enqueueDiscoveredCards(this.session, scrollRes.cards);
              if (addedCount > 0) {
                await saveSession(this.session);
                this.callbacks.broadcastToUI({ type: "SESSION_UPDATED", session: this.session });
              }
            }
          } catch (err) {
            console.debug("[Orchestrator] Proactive feed scroll error:", err);
          }
        }

        let nextItem = getNextQueuedItem(this.session);

        // If no queued item available but extraction limit is not yet reached, attempt loading more batches
        if (!nextItem) {
          let foundMore = false;
          for (let attempt = 0; attempt < 8; attempt++) {
            if (this.session.status !== "running") break;

            try {
              const scrollRes = (await this.callbacks.sendToContent({
                type: "SCROLL_RESULTS_FEED",
              })) as { cards?: RawCard[] } | undefined;

              if (scrollRes?.cards && scrollRes.cards.length > 0) {
                const { addedCount } = enqueueDiscoveredCards(this.session, scrollRes.cards);
                if (addedCount > 0) {
                  await saveSession(this.session);
                  this.callbacks.broadcastToUI({ type: "SESSION_UPDATED", session: this.session });
                }
              }

              nextItem = getNextQueuedItem(this.session);
              if (nextItem) {
                foundMore = true;
                break;
              }

              const stepDelay = Math.min(200, Math.max(20, Math.round((this.session.settingsSnapshot.minDelaySeconds || 0.2) * 500)));
              await delayMs(stepDelay);
            } catch (err) {
              console.debug("[Orchestrator] Exhaustion recovery scroll error:", err);
            }
          }

          // If still no queued items after 8 scroll attempts, the end of search results has genuinely been reached
          if (!foundMore || !nextItem) {
            this.session = applySessionAction(this.session, {
              type: "COMPLETE",
              reason: "results_exhausted",
            });
            await saveSession(this.session);
            this.callbacks.broadcastToUI({ type: "SESSION_UPDATED", session: this.session });
            break;
          }
        }

        // Process this business
        await this.processSingleBusiness(nextItem);

        if (this.session.status !== "running") {
          break;
        }

        // Apply jittered delay between businesses (PRD Section 16.1)
        const delay = getJitteredDelayMs(
          this.session.settingsSnapshot.minDelaySeconds,
          this.session.settingsSnapshot.maxDelaySeconds
        );
        if (delay > 0) {
          await delayMs(delay);
        }
      }
    } finally {
      this.isLoopRunning = false;
    }
  }

  /**
   * Processes a single business item in sequence
   */
  private async processSingleBusiness(item: QueueItem): Promise<void> {
    item.status = "processing";
    this.callbacks.broadcastToUI({ type: "SESSION_UPDATED", session: this.session });

    try {
      // Request raw extraction from content script
      const raw = await this.callbacks.requestRawExtraction(item);

      if (!raw || !raw.name) {
        throw new Error("Empty raw extraction received from target detail panel");
      }

      const extractedName = raw.name.trim();
      const isBadName =
        !extractedName ||
        extractedName.toLowerCase() === "results" ||
        extractedName.toLowerCase().startsWith("results for") ||
        extractedName.toLowerCase() === "search results" ||
        extractedName.toLowerCase() === "google maps";

      if (isBadName) {
        throw new Error(`Invalid business name extracted from detail panel: "${extractedName}"`);
      }

      // Normalize raw data into canonical record
      const partial = this.adapter.normalizeBusiness(raw);

      // Guard against extracting the wrong business place (e.g. detail panel didn't transition)
      const itemPlaceId = extractPlaceIdentifier(item.cardRef);
      const extractedPlaceId =
        partial.place_identifier ||
        (raw.mapsUrl ? extractPlaceIdentifier(raw.mapsUrl) : null);

      const isNameMatch = Boolean(
        item.name &&
        partial.business_name &&
        (partial.business_name.toLowerCase().includes(item.name.toLowerCase()) ||
         item.name.toLowerCase().includes(partial.business_name.toLowerCase()))
      );

      const isPlaceMismatch = Boolean(
        !isNameMatch &&
        itemPlaceId &&
        extractedPlaceId &&
        itemPlaceId.toLowerCase() !== extractedPlaceId.toLowerCase()
      );

      if (isPlaceMismatch) {
        throw new Error(`Target place mismatch: expected ${itemPlaceId}, got ${extractedPlaceId}`);
      }

      const finalName = partial.business_name || item.name;

      const isSearchMapsUrl =
        !partial.maps_url ||
        partial.maps_url.includes("/maps/search/") ||
        partial.maps_url.includes("/search?") ||
        partial.maps_url.endsWith("/maps") ||
        partial.maps_url.endsWith("/maps/");

      const finalMapsUrl =
        !isSearchMapsUrl && partial.maps_url
          ? partial.maps_url
          : item.cardRef || "";

      const finalPlaceId =
        partial.place_identifier || (finalMapsUrl ? extractPlaceIdentifier(finalMapsUrl) : null);

      const fallbackCoords =
        partial.latitude === null || partial.latitude === undefined
          ? extractCoordinates(finalMapsUrl)
          : { lat: partial.latitude, lng: partial.longitude };

      const record: BusinessRecord = {
        record_id: generateUUID(),
        business_name: finalName,
        primary_category: partial.primary_category || item.category || "Local Business",
        secondary_categories: partial.secondary_categories || [],
        rating: partial.rating ?? item.rating ?? null,
        review_count: partial.review_count ?? item.reviewCount ?? null,
        price_level: partial.price_level ?? null,
        address: partial.address || item.address || "",
        phone: partial.phone || item.phone || "",
        phone_raw: partial.phone_raw ?? item.phone ?? "",
        phone_normalized: partial.phone_normalized ?? "",
        phone_country: partial.phone_country ?? "",
        phone_country_calling_code: partial.phone_country_calling_code ?? "",
        phone_country_source: partial.phone_country_source ?? "unknown",
        phone_status: partial.phone_status ?? "unknown",
        whatsapp_link: partial.whatsapp_link ?? "",
        website: partial.website || "",
        website_status: partial.website_status || "none",
        social_links: partial.social_links || [],
        maps_url: finalMapsUrl,
        place_identifier: finalPlaceId,
        plus_code: partial.plus_code || null,
        latitude: fallbackCoords.lat ?? null,
        longitude: fallbackCoords.lng ?? null,
        opening_hours: partial.opening_hours || null,
        business_status: partial.business_status || "operational",
        description: partial.description || null,
        service_options: partial.service_options || [],
        attributes: partial.attributes || [],
        extraction_status: "complete",
        extraction_timestamp: new Date().toISOString(),
        missing_fields: [],
        error_fields: [],
        source_platform: "google_maps",
        duplicate_of: null,
      };

      const { missing_fields, error_fields } = computeMissingFields(record);
      record.missing_fields = missing_fields;
      record.error_fields = error_fields;

      // A record is "partial" only when important optional fields are missing.
      const IMPORTANT_OPTIONAL_FIELDS = ["phone", "website", "rating"];
      const hasImportantMissing = missing_fields.some((f) =>
        IMPORTANT_OPTIONAL_FIELDS.includes(f)
      );
      record.extraction_status =
        error_fields.length > 0
          ? "partial"
          : hasImportantMissing
          ? "partial"
          : "complete";

      // Atomic commit to IndexedDB
      const result = await saveProcessedBusinessTransaction(this.session, item, record);
      this.session = result.updatedSession;

      this.consecutiveFailures = 0;
      this.callbacks.broadcastToUI({ type: "RECORD_SAVED", record: result.savedRecord });
      this.callbacks.broadcastToUI({ type: "SESSION_UPDATED", session: this.session });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);

      console.debug(`[Orchestrator] Business "${item.name}" failed (retry ${item.retryCount}):`, errorMessage);

      // If verification detected, halt immediately!
      if (errorMessage.includes("verification_required")) {
        await this.pause("verification_required");
        return;
      }

      // If timed out or content script not responding — retry without counting as consecutive failure
      const isTransientError =
        errorMessage.includes("timed out") ||
        errorMessage.includes("Could not establish connection") ||
        errorMessage.includes("Receiving end does not exist") ||
        errorMessage.includes("message channel closed") ||
        errorMessage.includes("Empty raw extraction") ||
        errorMessage.includes("target_detail_not_ready") ||
        errorMessage.includes("Target place mismatch") ||
        errorMessage.includes("communication error");

      item.retryCount += 1;
      item.lastError = errorMessage;

      if (item.retryCount <= this.session.settingsSnapshot.maxRetriesPerBusiness) {
        // Wait exponential backoff and keep queued for retry
        const backoffBase = this.session.settingsSnapshot.minDelaySeconds <= 0.5 ? 0.2 : 2.0;
        const backoffMs = getExponentialBackoffMs(item.retryCount, backoffBase);
        item.status = "queued";
        await delayMs(backoffMs);
      } else {
        item.status = "failed";
        this.session.failedCount += 1;
        this.session.processedCount += 1;
        // Don't count transient errors toward consecutive failure threshold
        if (!isTransientError) {
          this.consecutiveFailures += 1;
        }
      }

      // Check consecutive failure threshold
      if (this.consecutiveFailures >= this.session.settingsSnapshot.maxConsecutiveFailures) {
        await this.pause("error_threshold");
        return;
      }

      await saveSession(this.session);
      this.callbacks.broadcastToUI({ type: "SESSION_UPDATED", session: this.session });
    }
  }
}
