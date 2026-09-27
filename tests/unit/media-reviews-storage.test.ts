import { beforeEach, describe, expect, it } from "vitest";
import { closeDb, getDb } from "../../src/core/storage/db";
import {
  canonicalizeGoogleMediaUrl,
  computeMediaFingerprint,
  deleteMediaReviewJob,
  getAllMediaReviewJobs,
  getMediaByBusiness,
  getMediaReviewJob,
  getMediaReviewJobByBusiness,
  getReviewsByBusiness,
  saveMediaRecordsBatch,
  saveMediaReviewJob,
  saveReviewRecordsBatch,
} from "../../src/core/storage/media-reviews-repo";
import { MediaRecord } from "../../src/core/schema/media-record";
import { ReviewRecord } from "../../src/core/schema/review-record";
import { DEFAULT_MEDIA_REVIEW_SETTINGS, MediaReviewJob } from "../../src/core/schema/media-review-job";

describe("Media & Reviews Storage and Fingerprinting (PRD Addendum §11, 12, 13.4, 17)", () => {
  beforeEach(async () => {
    closeDb();
    const db = await getDb();
    await db.clear("media_review_jobs");
    await db.clear("media_records");
    await db.clear("review_records");
  });

  it("canonicalizes Google Photos CDN URLs by stripping resolution/crop suffixes", () => {
    const rawUrl = "https://lh3.googleusercontent.com/p/AF1QipMxyz123=w1080-h608-k-no";
    const canonical = canonicalizeGoogleMediaUrl(rawUrl);
    expect(canonical).toBe("https://lh3.googleusercontent.com/p/AF1QipMxyz123");

    const squareThumb = "https://lh3.googleusercontent.com/p/AF1QipMxyz123=s120-c";
    expect(canonicalizeGoogleMediaUrl(squareThumb)).toBe("https://lh3.googleusercontent.com/p/AF1QipMxyz123");
  });

  it("computes stable media fingerprints across different thumbnail variants", () => {
    const mediaA: Partial<MediaRecord> = {
      media_url: "https://lh3.googleusercontent.com/p/AF1QipMxyz123=w1080-h608-k-no",
    };
    const mediaB: Partial<MediaRecord> = {
      media_url: "https://lh3.googleusercontent.com/p/AF1QipMxyz123=w400-h300-k-no",
    };
    expect(computeMediaFingerprint(mediaA)).toBe(computeMediaFingerprint(mediaB));
  });

  it("saves media records batch and performs fill-gaps merge on duplicate assets", async () => {
    const businessId = "biz-123";
    const item1: MediaRecord = {
      media_id: "med-1",
      source_media_id: null,
      business_id: businessId,
      source_business_id: "0x123:0x456",
      review_id: null,
      type: "photo",
      source_url: "https://maps.google.com/place/gallery",
      media_url: "https://lh3.googleusercontent.com/p/AF1QipMxyz123=w1080-h608-k-no",
      embed_url: "unavailable",
      thumbnail_url: "",
      title: "",
      caption: "",
      width: null,
      height: null,
      duration: null,
      source_context: "business_gallery",
      source_platform: "google_maps",
      extraction_status: "success",
      extraction_timestamp: new Date().toISOString(),
      missing_fields: [],
      error_fields: [],
    };

    // First batch save
    const res1 = await saveMediaRecordsBatch(businessId, [item1]);
    expect(res1.saved).toBe(1);
    expect(res1.duplicates).toBe(0);

    // Duplicate item with filled title
    const duplicateItem: MediaRecord = {
      ...item1,
      media_id: "med-2",
      media_url: "https://lh3.googleusercontent.com/p/AF1QipMxyz123=w400-h300-k-no",
      title: "Clinic Reception",
    };

    const res2 = await saveMediaRecordsBatch(businessId, [duplicateItem]);
    expect(res2.saved).toBe(0);
    expect(res2.duplicates).toBe(1);

    // Verify existing record had its gap filled
    const allMedia = await getMediaByBusiness(businessId);
    expect(allMedia).toHaveLength(1);
    expect(allMedia[0].media_id).toBe("med-1");
    expect(allMedia[0].title).toBe("Clinic Reception");
  });

  it("saves review records batch with inline review media and computes review fingerprints", async () => {
    const businessId = "biz-123";
    const reviewMedia: MediaRecord = {
      media_id: "rev-med-1",
      source_media_id: null,
      business_id: businessId,
      source_business_id: "0x123:0x456",
      review_id: "rev-1",
      type: "photo",
      source_url: "https://maps.google.com/place/reviews",
      media_url: "https://lh3.googleusercontent.com/p/AF1QipPatient1=w800-h600",
      embed_url: "unavailable",
      thumbnail_url: "",
      title: "",
      caption: "Clean clinic",
      width: null,
      height: null,
      duration: null,
      source_context: "review_media",
      source_platform: "google_maps",
      extraction_status: "success",
      extraction_timestamp: new Date().toISOString(),
      missing_fields: [],
      error_fields: [],
    };

    const review1: ReviewRecord = {
      review_id: "rev-1",
      source_review_id: "sr-999",
      business_id: businessId,
      source_business_id: "0x123:0x456",
      author_name: "Rahul Sharma",
      author_profile_url: "https://google.com/maps/contrib/111",
      author_review_count: 14,
      rating: 5,
      review_text: "Excellent service and painless treatment.",
      review_date: "2026-08-01T10:00:00Z",
      review_relative_time: "1 month ago",
      review_url: "",
      language: "en",
      owner_response: null,
      media: [reviewMedia],
      source_platform: "google_maps",
      extraction_status: "success",
      extraction_timestamp: new Date().toISOString(),
      missing_fields: [],
      error_fields: [],
    };

    const res = await saveReviewRecordsBatch(businessId, [review1]);
    expect(res.saved).toBe(1);

    const reviews = await getReviewsByBusiness(businessId);
    expect(reviews).toHaveLength(1);
    expect(reviews[0].author_name).toBe("Rahul Sharma");

    // Verify review media was stored into media_records as well
    const mediaItems = await getMediaByBusiness(businessId);
    expect(mediaItems).toHaveLength(1);
    expect(mediaItems[0].source_context).toBe("review_media");
    expect(mediaItems[0].review_id).toBe("rev-1");
  });

  it("stores and manages MediaReviewJob state transitions and deletions", async () => {
    const job: MediaReviewJob = {
      jobId: "job-1",
      businessId: "biz-123",
      businessName: "Smile Hub",
      sourceUrl: "https://maps.google.com/place/smile-hub",
      parentSessionId: null,
      status: "running",
      pauseReason: null,
      mediaStatus: "running",
      reviewStatus: "not_started" as any,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      mediaProgress: { photosFound: 10, photosExtracted: 5, videosFound: 0, videosExtracted: 0 },
      reviewProgress: { reviewsFound: 0, reviewsExtracted: 0, reviewMediaFound: 0, reviewMediaExtracted: 0 },
      settingsSnapshot: DEFAULT_MEDIA_REVIEW_SETTINGS,
    };

    await saveMediaReviewJob(job);

    const retrieved = await getMediaReviewJob("job-1");
    expect(retrieved).toBeDefined();
    expect(retrieved?.businessName).toBe("Smile Hub");

    const byBiz = await getMediaReviewJobByBusiness("biz-123");
    expect(byBiz?.jobId).toBe("job-1");

    const all = await getAllMediaReviewJobs();
    expect(all).toHaveLength(1);

    await deleteMediaReviewJob("job-1");
    const deleted = await getMediaReviewJob("job-1");
    expect(deleted).toBeUndefined();
  });
});
