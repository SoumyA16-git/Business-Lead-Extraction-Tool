import { beforeEach, describe, expect, it, vi } from "vitest";
import { closeDb, getDb } from "../../src/core/storage/db";
import {
  MediaReviewOrchestrator,
  normalizeRawMediaItem,
  normalizeRawReviewItem,
} from "../../src/core/engine/media-review-orchestrator";
import {
  getMediaByBusiness,
  getMediaReviewJobByBusiness,
  getReviewsByBusiness,
} from "../../src/core/storage/media-reviews-repo";
import { RawMediaItem } from "../../src/core/schema/media-record";
import { RawReviewItem } from "../../src/core/schema/review-record";
import { DetectedBusinessTarget } from "../../src/core/adapters/platform-adapter";
import { MediaReviewSettings } from "../../src/core/schema/media-review-job";

function createTestOrchestrator(
  businessId: string,
  title: string,
  url: string,
  callbacks: { sendToContent: (msg: unknown) => Promise<unknown>; broadcastToUI: (msg: unknown) => void },
  settings?: Partial<MediaReviewSettings>
): MediaReviewOrchestrator {
  const target: DetectedBusinessTarget = {
    business_name: title,
    address_preview: "123 Test St",
    maps_url: url,
    confidence: "high",
  };
  const job = MediaReviewOrchestrator.createJob(target, businessId, settings);
  return new MediaReviewOrchestrator(job, callbacks);
}

describe("MediaReviewOrchestrator Engine (PRD Addendum §18, 19, 20, 21, 39, 40)", () => {
  beforeEach(async () => {
    closeDb();
    const db = await getDb();
    await db.clear("media_review_jobs");
    await db.clear("media_records");
    await db.clear("review_records");
  });

  it("normalizes raw media items with standard fallback and schema compliance", () => {
    const raw: RawMediaItem = {
      type: "photo",
      sourceUrl: "https://maps.google.com/test",
      mediaUrl: "https://lh3.googleusercontent.com/p/AF1QipMtest123",
      sourceContext: "business_profile",
      thumbnailUrl: "https://lh3.googleusercontent.com/p/AF1QipMtest123=s120",
    };

    const record = normalizeRawMediaItem(raw, "biz_001", "https://maps.google.com/test");

    expect(record.business_id).toBe("biz_001");
    expect(record.type).toBe("photo");
    expect(record.media_url).toBe("https://lh3.googleusercontent.com/p/AF1QipMtest123");
    expect(record.embed_url).toBe("");
    expect(record.source_platform).toBe("google_maps");
    expect(record.extraction_status).toBe("success");
    expect(record.missing_fields).toEqual([]);
  });

  it("normalizes raw review items including nested media attachments and missing text detection", () => {
    const raw: RawReviewItem = {
      authorName: "Sarah Connor",
      rating: 5,
      reviewText: "",
      reviewDate: "2026-03-01T10:00:00.000Z",
      reviewRelativeTime: "2 weeks ago",
      media: [
        {
          type: "photo",
          sourceUrl: "https://maps.google.com/test",
          mediaUrl: "https://lh3.googleusercontent.com/p/attached_photo_1",
          sourceContext: "review_media",
        },
      ],
    };

    const record = normalizeRawReviewItem(raw, "biz_002", "https://maps.google.com/test");

    expect(record.business_id).toBe("biz_002");
    expect(record.author_name).toBe("Sarah Connor");
    expect(record.rating).toBe(5);
    expect(record.missing_fields).toContain("review_text");
    expect(record.media).toHaveLength(1);
    expect(record.media[0].source_context).toBe("review_media");
  });

  it("initializes job and correctly tracks media ingestion and persistence", async () => {
    const broadcastFn = vi.fn();
    const sendToContentFn = vi.fn().mockResolvedValue({ success: true });

    const orchestrator = createTestOrchestrator(
      "biz_test_orchestrator",
      "Test Clinic",
      "https://www.google.com/maps/place/Test+Clinic",
      {
        sendToContent: sendToContentFn,
        broadcastToUI: broadcastFn,
      },
      {
        maxPhotos: 10,
        maxReviews: 10,
        extractPhotos: true,
        extractReviews: true,
      }
    );

    const job = orchestrator.getJob();
    expect(job.businessId).toBe("biz_test_orchestrator");
    expect(job.businessName).toBe("Test Clinic");
    expect(job.mediaStatus).toBe("running");
    expect(job.reviewStatus).toBe("running");

    // Simulate discovering 2 media items
    const rawMedia: RawMediaItem[] = [
      {
        type: "photo",
        sourceUrl: "https://maps.google.com/place/gallery",
        mediaUrl: "https://lh3.googleusercontent.com/p/photo_1",
        sourceContext: "business_gallery",
      },
      {
        type: "video",
        sourceUrl: "https://maps.google.com/place/gallery",
        mediaUrl: "https://lh3.googleusercontent.com/p/video_1",
        sourceContext: "business_gallery",
      },
    ];

    await orchestrator.handleMediaDiscovered(rawMedia);

    // Verify job progress updated
    expect(orchestrator.getJob().mediaProgress.photosExtracted).toBe(2);
    expect(broadcastFn).toHaveBeenCalled();

    // Verify stored in repository
    const storedMedia = await getMediaByBusiness("biz_test_orchestrator");
    expect(storedMedia).toHaveLength(2);
  });

  it("correctly handles review ingestion, deduplication, and progress counts", async () => {
    const broadcastFn = vi.fn();
    const sendToContentFn = vi.fn().mockResolvedValue({ success: true });

    const orchestrator = createTestOrchestrator(
      "biz_reviews_test",
      "Reviews Dental",
      "https://www.google.com/maps/place/Reviews+Dental",
      {
        sendToContent: sendToContentFn,
        broadcastToUI: broadcastFn,
      }
    );

    const rawReviews: RawReviewItem[] = [
      {
        authorName: "John Doe",
        rating: 5,
        reviewText: "Excellent dentist, very gentle!",
        reviewDate: "2026-02-15T12:00:00Z",
      },
      {
        authorName: "Jane Smith",
        rating: 4,
        reviewText: "Clean environment and friendly staff.",
        reviewDate: "2026-01-20T10:00:00Z",
      },
    ];

    await orchestrator.handleReviewsDiscovered(rawReviews, 232);

    expect(orchestrator.getJob().reviewProgress.reviewsAvailable).toBe(232);
    expect(orchestrator.getJob().reviewProgress.reviewsExtracted).toBe(2);
    expect(orchestrator.getJob().reviewSummary?.reported_review_count).toBe(232);
    expect(orchestrator.getJob().reviewSummary?.reviews_extracted).toBe(2);

    const storedReviews = await getReviewsByBusiness("biz_reviews_test");
    expect(storedReviews).toHaveLength(2);
  });

  it("triggers hard pause and sets pauseReason = 'verification_required' on challenge", async () => {
    const broadcastFn = vi.fn();
    const sendToContentFn = vi.fn().mockResolvedValue({ success: true });

    const orchestrator = createTestOrchestrator(
      "biz_challenge_test",
      "Challenge Biz",
      "https://www.google.com/maps/place/Challenge+Biz",
      {
        sendToContent: sendToContentFn,
        broadcastToUI: broadcastFn,
      }
    );

    await orchestrator.handleVerification();

    const job = orchestrator.getJob();
    expect(job.status).toBe("paused");
    expect(job.mediaStatus).toBe("paused");
    expect(job.reviewStatus).toBe("paused");
    expect(job.pauseReason).toBe("verification_required");
    expect(job.error_message).toContain("Verification challenge");

    // Persisted to DB
    const persisted = await getMediaReviewJobByBusiness("biz_challenge_test");
    expect(persisted?.pauseReason).toBe("verification_required");
  });

  it("handles track-level pauses, resumes, and stops accurately", async () => {
    const broadcastFn = vi.fn();
    const sendToContentFn = vi.fn().mockResolvedValue({ success: true });

    const orchestrator = createTestOrchestrator(
      "biz_track_controls",
      "Track Control Biz",
      "https://www.google.com/maps/place/Track+Control+Biz",
      {
        sendToContent: sendToContentFn,
        broadcastToUI: broadcastFn,
      }
    );

    // Pause only media track
    await orchestrator.pause("media");
    expect(orchestrator.getJob().mediaStatus).toBe("paused");
    expect(orchestrator.getJob().reviewStatus).toBe("running");
    expect(orchestrator.getJob().status).toBe("running"); // At least one track is running

    // Pause review track as well
    await orchestrator.pause("reviews");
    expect(orchestrator.getJob().status).toBe("paused");

    // Resume media track
    await orchestrator.resume("media");
    expect(orchestrator.getJob().mediaStatus).toBe("running");
    expect(orchestrator.getJob().status).toBe("running");

    // Stop all
    await orchestrator.stop();
    expect(orchestrator.getJob().status).toBe("stopped");
    expect(orchestrator.getJob().mediaStatus).toBe("complete");
    expect(orchestrator.getJob().reviewStatus).toBe("complete");
  });
});
