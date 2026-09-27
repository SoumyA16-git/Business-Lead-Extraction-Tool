/**
 * Business Media & Reviews Extraction Orchestration Engine
 * Defined in PRD Addendum Section 18, 19, 20, 21, 39, 40
 */

import { DetectedBusinessTarget } from "../adapters/platform-adapter";
import {
  DEFAULT_MEDIA_REVIEW_SETTINGS,
  MediaReviewJob,
  MediaReviewSettings,
} from "../schema/media-review-job";
import { MediaRecord, MediaExtractionStatus, RawMediaItem } from "../schema/media-record";
import { ReviewRecord, RawReviewItem } from "../schema/review-record";
import {
  batchSaveMediaRecords,
  batchSaveReviewRecords,
  saveMediaReviewJob,
} from "../storage/media-reviews-repo";
import { delayMs, getJitteredDelayMs } from "../../utils/time";

export interface MediaReviewCallbacks {
  sendToContent: (message: unknown) => Promise<unknown>;
  broadcastToUI: (message: unknown) => void;
}

export function normalizeRawMediaItem(
  raw: RawMediaItem,
  businessId: string,
  sourceUrl: string
): MediaRecord {
  const missing_fields: string[] = [];
  const error_fields: string[] = [];

  let status: MediaExtractionStatus = "success";
  if (!raw.mediaUrl) {
    status = "partial";
    missing_fields.push("media_url");
  }

  return {
    media_id: `med_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    source_media_id: raw.sourceMediaId || null,
    business_id: businessId,
    source_business_id: null,
    review_id: raw.reviewId || null,
    type: raw.type,
    source_url: raw.sourceUrl || sourceUrl,
    media_url: raw.mediaUrl,
    embed_url: raw.embedUrl || "",
    thumbnail_url: raw.thumbnailUrl || "",
    title: raw.title || "",
    caption: raw.caption || "",
    width: raw.width ?? null,
    height: raw.height ?? null,
    duration: raw.duration ?? null,
    source_context: raw.sourceContext,
    source_platform: "google_maps",
    extraction_status: status,
    extraction_timestamp: new Date().toISOString(),
    missing_fields,
    error_fields,
  };
}

export function normalizeRawReviewItem(
  raw: RawReviewItem,
  businessId: string,
  sourceUrl: string
): ReviewRecord {
  const missing_fields: string[] = [];
  const error_fields: string[] = [];

  if (!raw.reviewText) missing_fields.push("review_text");
  if (!raw.reviewDate) missing_fields.push("review_date");

  const attachedMedia = (raw.media || []).map((m) =>
    normalizeRawMediaItem(m, businessId, sourceUrl)
  );

  return {
    review_id: `rev_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    source_review_id: raw.sourceReviewId || null,
    business_id: businessId,
    source_business_id: null,
    author_name: raw.authorName || "Google User",
    author_profile_url: raw.authorProfileUrl || "",
    author_review_count: raw.authorReviewCount ?? null,
    rating: raw.rating,
    review_text: raw.reviewText || "",
    review_date: raw.reviewDate || "",
    review_relative_time: raw.reviewRelativeTime || "",
    review_url: raw.reviewUrl || "",
    language: raw.language || "en",
    owner_response: raw.ownerResponse || null,
    media: attachedMedia,
    source_platform: "google_maps",
    extraction_status: "success",
    extraction_timestamp: new Date().toISOString(),
    missing_fields,
    error_fields,
  };
}

export class MediaReviewOrchestrator {
  private job: MediaReviewJob;
  private callbacks: MediaReviewCallbacks;
  private isMediaLoopRunning = false;
  private isReviewLoopRunning = false;
  private consecutiveMediaFailures = 0;
  private consecutiveReviewFailures = 0;
  private emptyMediaScrolls = 0;
  private emptyReviewScrolls = 0;

  constructor(job: MediaReviewJob, callbacks: MediaReviewCallbacks) {
    this.job = job;
    this.callbacks = callbacks;
  }

  public getJob(): MediaReviewJob {
    return this.job;
  }

  public setJob(job: MediaReviewJob): void {
    this.job = job;
  }

  /**
   * Factory to initialize a new job for a target
   */
  public static createJob(
    target: DetectedBusinessTarget,
    businessId: string,
    settings?: Partial<MediaReviewSettings>,
    parentSessionId: string | null = null
  ): MediaReviewJob {
    const mergedSettings: MediaReviewSettings = {
      ...DEFAULT_MEDIA_REVIEW_SETTINGS,
      ...settings,
    };

    const now = new Date().toISOString();
    return {
      jobId: `mrj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      businessId,
      businessName: target.business_name,
      sourceUrl: target.maps_url,
      parentSessionId,
      status: "idle",
      pauseReason: null,
      mediaStatus: mergedSettings.extractPhotos || mergedSettings.extractVideos ? "running" : "complete",
      reviewStatus: mergedSettings.extractReviews ? "running" : "complete",
      createdAt: now,
      updatedAt: now,
      completedAt: null,
      error_message: null,
      mediaProgress: {
        photosFound: 0,
        photosExtracted: 0,
        videosFound: 0,
        videosExtracted: 0,
      },
      reviewProgress: {
        reviewsAvailable: null,
        reviewsFound: 0,
        reviewsExtracted: 0,
        reviewMediaFound: 0,
        reviewMediaExtracted: 0,
      },
      reviewSummary: {
        reported_review_count: null,
        reviews_found: 0,
        reviews_extracted: 0,
        reviews_failed: 0,
        count_discrepancy: false,
        status: mergedSettings.extractReviews ? "partial" : "empty",
        sort_mode: "default",
      },
      settingsSnapshot: mergedSettings,
    };
  }

  /**
   * Starts or resumes the extraction process for active tracks
   */
  public async start(): Promise<void> {
    this.job.status = "running";
    this.job.updatedAt = new Date().toISOString();

    if (this.job.settingsSnapshot.extractPhotos || this.job.settingsSnapshot.extractVideos) {
      if (this.job.mediaStatus !== "complete") {
        this.job.mediaStatus = "running";
      }
    }
    if (this.job.settingsSnapshot.extractReviews) {
      if (this.job.reviewStatus !== "complete") {
        this.job.reviewStatus = "running";
      }
    }

    await saveMediaReviewJob(this.job);
    this.callbacks.broadcastToUI({ type: "MEDIA_REVIEW_JOB_UPDATED", job: this.job });

    if (this.job.mediaStatus === "running") {
      this.runMediaTrack();
    }
    if (this.job.reviewStatus === "running") {
      this.runReviewTrack();
    }
  }

  /**
   * Pauses media, review, or both tracks (PRD §19, §20)
   */
  public async pause(track: "media" | "review" | "reviews" | "all" = "all"): Promise<void> {
    const now = new Date().toISOString();
    if (track === "media" || track === "all") {
      if (this.job.mediaStatus === "running") {
        this.job.mediaStatus = "paused";
      }
    }
    if (track === "review" || track === "reviews" || track === "all") {
      if (this.job.reviewStatus === "running") {
        this.job.reviewStatus = "paused";
      }
    }

    this.updateOverallStatus();
    this.job.updatedAt = now;
    await saveMediaReviewJob(this.job);
    this.callbacks.broadcastToUI({ type: "MEDIA_REVIEW_JOB_UPDATED", job: this.job });
  }

  /**
   * Resumes paused tracks
   */
  public async resume(track: "media" | "review" | "reviews" | "all" = "all"): Promise<void> {
    const now = new Date().toISOString();
    if (track === "media" || track === "all") {
      if (this.job.mediaStatus === "paused" || this.job.mediaStatus === "failed") {
        this.job.mediaStatus = "running";
        this.consecutiveMediaFailures = 0;
      }
    }
    if (track === "review" || track === "reviews" || track === "all") {
      if (this.job.reviewStatus === "paused" || this.job.reviewStatus === "failed") {
        this.job.reviewStatus = "running";
        this.consecutiveReviewFailures = 0;
      }
    }

    this.updateOverallStatus();
    this.job.updatedAt = now;
    await saveMediaReviewJob(this.job);
    this.callbacks.broadcastToUI({ type: "MEDIA_REVIEW_JOB_UPDATED", job: this.job });

    if (this.job.mediaStatus === "running" && !this.isMediaLoopRunning) {
      this.runMediaTrack();
    }
    if (this.job.reviewStatus === "running" && !this.isReviewLoopRunning) {
      this.runReviewTrack();
    }
  }

  /**
   * Permanently stops both tracks, preserving all persisted records (PRD §21)
   */
  public async stop(): Promise<void> {
    const now = new Date().toISOString();
    this.job.status = "stopped";
    this.job.mediaStatus = "complete";
    this.job.reviewStatus = "complete";
    this.job.completedAt = now;
    this.job.updatedAt = now;

    await saveMediaReviewJob(this.job);
    this.callbacks.broadcastToUI({ type: "MEDIA_REVIEW_JOB_UPDATED", job: this.job });
  }

  /**
   * Verification challenge detected: immediate hard pause (PRD §40, §41)
   */
  public async handleVerification(): Promise<void> {
    await this.pause("all");
    this.job.pauseReason = "verification_required";
    this.job.error_message = "Verification challenge detected. Extraction paused.";
    await saveMediaReviewJob(this.job);
    this.callbacks.broadcastToUI({ type: "MEDIA_REVIEW_JOB_UPDATED", job: this.job });
  }

  /**
   * Ingest discovered media items from content script
   */
  public async handleMediaDiscovered(rawItems: RawMediaItem[]): Promise<void> {
    if (this.job.mediaStatus !== "running") return;

    try {
      const records = rawItems.map((item) =>
        normalizeRawMediaItem(item, this.job.businessId, this.job.sourceUrl)
      );
      const result = await batchSaveMediaRecords(this.job.businessId, records);

      if (result.saved > 0) {
        this.emptyMediaScrolls = 0;
        this.consecutiveMediaFailures = 0;
      }

      this.job.mediaProgress.photosExtracted += result.saved;
      this.job.mediaProgress.photosFound = Math.max(
        this.job.mediaProgress.photosFound,
        this.job.mediaProgress.photosExtracted,
        rawItems.length
      );
      this.job.updatedAt = new Date().toISOString();

      await saveMediaReviewJob(this.job);
      this.callbacks.broadcastToUI({ type: "MEDIA_REVIEW_JOB_UPDATED", job: this.job });

      const maxMedia = this.job.settingsSnapshot.maxPhotos;
      if (maxMedia > 0 && this.job.mediaProgress.photosExtracted >= maxMedia) {
        await this.handleMediaExhausted();
      }
    } catch (err: any) {
      this.consecutiveMediaFailures++;
      if (this.consecutiveMediaFailures >= 3) {
        await this.pause("media");
        this.job.pauseReason = "error_threshold";
        this.job.error_message = `Media extraction paused after 3 consecutive failures: ${err?.message || err}`;
        await saveMediaReviewJob(this.job);
        this.callbacks.broadcastToUI({ type: "MEDIA_REVIEW_JOB_UPDATED", job: this.job });
      }
    }
  }

  /**
   * Ingest discovered reviews from content script
   */
  public async handleReviewsDiscovered(
    rawReviews: RawReviewItem[],
    reportedCount?: number | null
  ): Promise<void> {
    if (this.job.reviewStatus !== "running") return;

    try {
      if (reportedCount && reportedCount > 0) {
        this.job.reviewProgress.reviewsAvailable = reportedCount;
        if (this.job.reviewSummary) {
          this.job.reviewSummary.reported_review_count = reportedCount;
        }
      }

      const records = rawReviews.map((r) =>
        normalizeRawReviewItem(r, this.job.businessId, this.job.sourceUrl)
      );
      const result = await batchSaveReviewRecords(this.job.businessId, records);

      if (result.saved > 0) {
        this.emptyReviewScrolls = 0;
        this.consecutiveReviewFailures = 0;
      }

      this.job.reviewProgress.reviewsExtracted += result.saved;
      this.job.reviewProgress.reviewsFound = Math.max(
        this.job.reviewProgress.reviewsFound,
        this.job.reviewProgress.reviewsExtracted,
        rawReviews.length
      );
      if (this.job.reviewSummary) {
        this.job.reviewSummary.reviews_extracted = this.job.reviewProgress.reviewsExtracted;
        this.job.reviewSummary.reviews_found = this.job.reviewProgress.reviewsFound;
      }
      this.job.updatedAt = new Date().toISOString();

      await saveMediaReviewJob(this.job);
      this.callbacks.broadcastToUI({ type: "MEDIA_REVIEW_JOB_UPDATED", job: this.job });

      const maxReviews = this.job.settingsSnapshot.maxReviews;
      if (maxReviews > 0 && this.job.reviewProgress.reviewsExtracted >= maxReviews) {
        await this.handleReviewsExhausted();
      }
    } catch (err: any) {
      this.consecutiveReviewFailures++;
      if (this.consecutiveReviewFailures >= 3) {
        await this.pause("review");
        this.job.pauseReason = "error_threshold";
        this.job.error_message = `Review extraction paused after 3 consecutive failures: ${err?.message || err}`;
        await saveMediaReviewJob(this.job);
        this.callbacks.broadcastToUI({ type: "MEDIA_REVIEW_JOB_UPDATED", job: this.job });
      }
    }
  }

  /**
   * Mark media feed exhausted (3 consecutive empty scrolls or end of feed)
   */
  public async handleMediaExhausted(): Promise<void> {
    this.job.mediaStatus = "complete";
    this.updateOverallStatus();
    this.job.updatedAt = new Date().toISOString();
    await saveMediaReviewJob(this.job);
    this.callbacks.broadcastToUI({ type: "MEDIA_REVIEW_JOB_UPDATED", job: this.job });
  }

  /**
   * Mark reviews feed exhausted (3 consecutive empty scrolls or end of feed)
   */
  public async handleReviewsExhausted(): Promise<void> {
    this.job.reviewStatus = "complete";
    if (this.job.reviewSummary) {
      this.job.reviewSummary.status =
        this.job.reviewProgress.reviewsExtracted === 0 ? "empty" : "complete";
    }
    this.updateOverallStatus();
    this.job.updatedAt = new Date().toISOString();
    await saveMediaReviewJob(this.job);
    this.callbacks.broadcastToUI({ type: "MEDIA_REVIEW_JOB_UPDATED", job: this.job });
  }

  /**
   * Media Track Execution Loop
   */
  private async runMediaTrack(): Promise<void> {
    if (this.isMediaLoopRunning) return;
    this.isMediaLoopRunning = true;

    try {
      try {
        await this.callbacks.sendToContent({ type: "SWITCH_TAB", tab: "Photos" });
      } catch (tabErr) {
        console.warn("[MediaReviewOrchestrator] SWITCH_TAB Photos error:", tabErr);
      }
      await delayMs(1200);

      const minSec = this.job.settingsSnapshot.minDelaySeconds || 2.5;
      const maxSec = this.job.settingsSnapshot.maxDelaySeconds || (minSec + 1.5);

      while (this.job.mediaStatus === "running") {
        try {
          await this.callbacks.sendToContent({
            type: "TRIGGER_MEDIA_DISCOVERY",
            jobId: this.job.jobId,
            context: "business_gallery",
          });
          this.consecutiveMediaFailures = 0;
        } catch (discErr) {
          console.warn("[MediaReviewOrchestrator] Transient media discovery error:", discErr);
          this.consecutiveMediaFailures++;
          if (this.consecutiveMediaFailures >= 3) {
            await this.pause("media");
            this.job.pauseReason = "error_threshold";
            this.job.error_message = `Media extraction paused after 3 consecutive failures: ${discErr instanceof Error ? discErr.message : discErr}`;
            await saveMediaReviewJob(this.job);
            this.callbacks.broadcastToUI({ type: "MEDIA_REVIEW_JOB_UPDATED", job: this.job });
            break;
          }
          await delayMs(1500);
          continue;
        }

        const delay = getJitteredDelayMs(minSec, maxSec);
        await delayMs(delay);

        if (this.job.mediaStatus !== "running") break;

        let scrollRes: { scrolled?: boolean } | undefined;
        try {
          scrollRes = (await this.callbacks.sendToContent({
            type: "TRIGGER_MEDIA_SCROLL",
            jobId: this.job.jobId,
          })) as { scrolled?: boolean } | undefined;
        } catch (scrollErr) {
          console.warn("[MediaReviewOrchestrator] Transient media scroll error:", scrollErr);
        }

        if (!scrollRes?.scrolled) {
          this.emptyMediaScrolls++;
        } else {
          this.emptyMediaScrolls = 0;
        }

        if (this.emptyMediaScrolls >= 3) {
          await this.handleMediaExhausted();
          break;
        }

        await delayMs(800);
      }
    } catch (err) {
      console.error("[MediaReviewOrchestrator] Error in media track loop:", err);
    } finally {
      this.isMediaLoopRunning = false;
    }
  }

  /**
   * Review Track Execution Loop
   */
  private async runReviewTrack(): Promise<void> {
    if (this.isReviewLoopRunning) return;
    this.isReviewLoopRunning = true;

    try {
      // Navigate to the Reviews tab first
      try {
        await this.callbacks.sendToContent({ type: "SWITCH_TAB", tab: "Reviews" });
      } catch (tabErr) {
        console.warn("[MediaReviewOrchestrator] SWITCH_TAB Reviews error:", tabErr);
      }
      await delayMs(1200);

      // Click the global "More reviews" button if present before starting scroll loop
      try {
        await this.callbacks.sendToContent({
          type: "TRIGGER_REVIEWS_SCROLL",
          jobId: this.job.jobId,
        });
      } catch (initialScrollErr) {
        console.warn("[MediaReviewOrchestrator] Initial reviews scroll attempt:", initialScrollErr);
      }
      await delayMs(1200);

      const minSec = this.job.settingsSnapshot.minDelaySeconds || 2.5;
      const maxSec = this.job.settingsSnapshot.maxDelaySeconds || (minSec + 1.5);

      let lastExtractedCount = this.job.reviewProgress.reviewsExtracted;

      while (this.job.reviewStatus === "running") {
        try {
          const discRes = (await this.callbacks.sendToContent({
            type: "TRIGGER_REVIEWS_DISCOVERY",
            jobId: this.job.jobId,
          })) as { success?: boolean; count?: number; reviews?: RawReviewItem[]; error?: string } | undefined;

          if (discRes?.error) {
            console.warn("[MediaReviewOrchestrator] Review discovery reported error:", discRes.error);
          }
          this.consecutiveReviewFailures = 0;
        } catch (discErr) {
          console.warn("[MediaReviewOrchestrator] Transient review discovery error:", discErr);
          this.consecutiveReviewFailures++;
          if (this.consecutiveReviewFailures >= 3) {
            await this.pause("review");
            this.job.pauseReason = "error_threshold";
            this.job.error_message = `Review extraction paused after 3 consecutive failures: ${discErr instanceof Error ? discErr.message : discErr}`;
            await saveMediaReviewJob(this.job);
            this.callbacks.broadcastToUI({ type: "MEDIA_REVIEW_JOB_UPDATED", job: this.job });
            break;
          }
          await delayMs(1500);
          continue;
        }

        const delay = getJitteredDelayMs(minSec, maxSec);
        await delayMs(delay);

        if (this.job.reviewStatus !== "running") break;

        // Reset empty scroll counter if new reviews were saved since last iteration
        if (this.job.reviewProgress.reviewsExtracted > lastExtractedCount) {
          this.emptyReviewScrolls = 0;
          lastExtractedCount = this.job.reviewProgress.reviewsExtracted;
        }

        let scrollRes: { scrolled?: boolean } | undefined;
        try {
          scrollRes = (await this.callbacks.sendToContent({
            type: "TRIGGER_REVIEWS_SCROLL",
            jobId: this.job.jobId,
          })) as { scrolled?: boolean } | undefined;
        } catch (scrollErr) {
          console.warn("[MediaReviewOrchestrator] Transient review scroll error:", scrollErr);
        }

        if (!scrollRes?.scrolled) {
          this.emptyReviewScrolls++;
        } else {
          // Scroll succeeded — reset empty counter (more content loading)
          this.emptyReviewScrolls = 0;
        }

        // Only exhaust after 5 consecutive empty scrolls to handle slow Google Maps loading
        if (this.emptyReviewScrolls >= 5) {
          await this.handleReviewsExhausted();
          break;
        }

        await delayMs(800);
      }
    } catch (err) {
      console.error("[MediaReviewOrchestrator] Error in review track loop:", err);
    } finally {
      this.isReviewLoopRunning = false;
    }
  }

  /**
   * Computes derived overall job status based on track statuses
   */
  private updateOverallStatus(): void {
    const m = this.job.mediaStatus;
    const r = this.job.reviewStatus;

    if (m === "running" || r === "running") {
      this.job.status = "running";
    } else if (m === "paused" || r === "paused") {
      this.job.status = "paused";
    } else if (m === "complete" && r === "complete") {
      this.job.status = "completed";
      this.job.completedAt = new Date().toISOString();
    } else if (m === "failed" && r === "failed") {
      this.job.status = "failed";
    } else {
      this.job.status = "partial";
    }
  }
}
