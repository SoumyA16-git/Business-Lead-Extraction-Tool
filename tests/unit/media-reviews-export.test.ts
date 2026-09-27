import { describe, it, expect } from "vitest";
import {
  serializeMediaCsv,
  serializeReviewsCsv,
  serializeCombinedJson,
} from "../../src/core/export/media-reviews-export";
import { MediaRecord } from "../../src/core/schema/media-record";
import { ReviewRecord } from "../../src/core/schema/review-record";

describe("Media & Reviews Export Serializers", () => {
  const dummyMedia: MediaRecord[] = [
    {
      media_id: "med_1",
      source_media_id: "src_m_1",
      business_id: "biz_100",
      source_business_id: "place_123",
      review_id: null,
      type: "photo",
      source_url: "https://maps.google.com",
      media_url: "https://lh5.googleusercontent.com/p/AF1Qip=w1920-h1080-k-no",
      embed_url: "unavailable",
      thumbnail_url: "",
      title: "Clinic Interior, Entrance",
      caption: "Reception",
      width: 1920,
      height: 1080,
      duration: null,
      source_context: "business_gallery",
      source_platform: "google_maps",
      extraction_status: "success",
      extraction_timestamp: "2026-09-09T08:00:00.000Z",
      missing_fields: [],
      error_fields: [],
    },
    {
      media_id: "med_2",
      source_media_id: "src_m_2",
      business_id: "biz_100",
      source_business_id: "place_123",
      review_id: null,
      type: "photo",
      source_url: "https://maps.google.com",
      media_url: "https://lh5.googleusercontent.com/p/AF1QipDup",
      embed_url: "unavailable",
      thumbnail_url: "",
      title: "Duplicate Item",
      caption: "",
      width: null,
      height: null,
      duration: null,
      source_context: "business_gallery",
      source_platform: "google_maps",
      extraction_status: "duplicate",
      extraction_timestamp: "2026-09-09T08:01:00.000Z",
      missing_fields: [],
      error_fields: [],
    },
  ];

  const dummyReviews: ReviewRecord[] = [
    {
      review_id: "rev_1",
      source_review_id: "src_r_1",
      business_id: "biz_100",
      source_business_id: "place_123",
      author_name: "Sarah Connor",
      author_profile_url: "https://google.com/contrib/sarah",
      author_review_count: 12,
      rating: 5,
      review_text: 'Excellent dental clinic! "Loved the staff", very polite.',
      review_date: "2026-08-01T00:00:00.000Z",
      review_relative_time: "1 month ago",
      review_url: "",
      language: "en",
      owner_response: {
        text: "Thank you Sarah for your kind words!",
        date: "2026-08-02",
      },
      media: [],
      source_platform: "google_maps",
      extraction_status: "success",
      extraction_timestamp: "2026-09-09T08:00:00.000Z",
      missing_fields: [],
      error_fields: [],
    },
  ];

  it("serializes media records to CSV correctly escaping commas and quotes", () => {
    const csv = serializeMediaCsv(dummyMedia, { includeDuplicates: false }, "Apex Clinic");
    expect(csv).toContain("business_name,business_id,media_id");
    expect(csv).toContain("Apex Clinic");
    expect(csv).toContain('"Clinic Interior, Entrance"');
    // Duplicate excluded by default
    expect(csv).not.toContain("med_2");
  });

  it("serializes review records to CSV correctly with owner responses and escaped text", () => {
    const csv = serializeReviewsCsv(dummyReviews, {}, "Apex Clinic");
    expect(csv).toContain("business_name,business_id,review_id");
    expect(csv).toContain("Apex Clinic");
    expect(csv).toContain("Sarah Connor");
    expect(csv).toContain('""Loved the staff""');
    expect(csv).toContain("Thank you Sarah for your kind words!");
  });

  it("serializes combined JSON package linked by business_id", () => {
    const jsonStr = serializeCombinedJson(
      { record_id: "biz_100", business_name: "Apex Clinic" },
      dummyMedia,
      dummyReviews
    );
    const parsed = JSON.parse(jsonStr);
    expect(parsed.export_metadata.format).toBe("business_media_reviews_v1");
    expect(parsed.export_metadata.business_id).toBe("biz_100");
    expect(parsed.business.business_name).toBe("Apex Clinic");
    expect(parsed.media.length).toBe(1); // duplicate filtered
    expect(parsed.reviews.length).toBe(1);
  });
});
