/**
 * Business Media & Reviews Export Serializers
 * Defined in PRD Addendum Sections 27, 28, 29
 */

import { BusinessRecord } from "../schema/business-record";
import { MediaRecord } from "../schema/media-record";
import { ReviewRecord } from "../schema/review-record";

export interface MediaExportOptions {
  missingPlaceholder?: string;
  includeDuplicates?: boolean;
}

export interface ReviewExportOptions {
  missingPlaceholder?: string;
  includeDuplicates?: boolean;
}

function escapeCsvCell(val: unknown, missingPlaceholder = ""): string {
  if (val === null || val === undefined) {
    return missingPlaceholder;
  }
  let str = "";
  if (Array.isArray(val)) {
    str = val.join("; ");
  } else if (typeof val === "object") {
    str = JSON.stringify(val);
  } else {
    str = String(val);
  }

  if (str === "") return missingPlaceholder;

  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Serializes MediaRecord array to CSV string
 */
/**
 * Serializes MediaRecord array to CSV string
 */
export function serializeMediaCsv(
  records: MediaRecord[],
  options: MediaExportOptions = {},
  businessName?: string
): string {
  const placeholder = options.missingPlaceholder ?? "";
  const filtered = options.includeDuplicates
    ? records
    : records.filter((r) => r.extraction_status !== "duplicate");

  const headers = [
    "business_name",
    "business_id",
    "media_id",
    "source_media_id",
    "source_business_id",
    "review_id",
    "type",
    "source_context",
    "source_url",
    "media_url",
    "embed_url",
    "thumbnail_url",
    "title",
    "caption",
    "width",
    "height",
    "duration",
    "source_platform",
    "extraction_status",
    "extraction_timestamp",
    "missing_fields",
    "error_fields",
  ];

  const rows: string[] = [headers.join(",")];

  for (const r of filtered) {
    const row = [
      escapeCsvCell(businessName || "", placeholder),
      escapeCsvCell(r.business_id, placeholder),
      escapeCsvCell(r.media_id, placeholder),
      escapeCsvCell(r.source_media_id, placeholder),
      escapeCsvCell(r.source_business_id, placeholder),
      escapeCsvCell(r.review_id, placeholder),
      escapeCsvCell(r.type, placeholder),
      escapeCsvCell(r.source_context, placeholder),
      escapeCsvCell(r.source_url, placeholder),
      escapeCsvCell(r.media_url, placeholder),
      escapeCsvCell(r.embed_url, placeholder),
      escapeCsvCell(r.thumbnail_url, placeholder),
      escapeCsvCell(r.title, placeholder),
      escapeCsvCell(r.caption, placeholder),
      escapeCsvCell(r.width, placeholder),
      escapeCsvCell(r.height, placeholder),
      escapeCsvCell(r.duration, placeholder),
      escapeCsvCell(r.source_platform, placeholder),
      escapeCsvCell(r.extraction_status, placeholder),
      escapeCsvCell(r.extraction_timestamp, placeholder),
      escapeCsvCell(r.missing_fields, placeholder),
      escapeCsvCell(r.error_fields, placeholder),
    ];
    rows.push(row.join(","));
  }

  return rows.join("\r\n");
}

/**
 * Serializes ReviewRecord array to CSV string
 */
export function serializeReviewsCsv(
  records: ReviewRecord[],
  options: ReviewExportOptions = {},
  businessName?: string
): string {
  const placeholder = options.missingPlaceholder ?? "";
  const filtered = options.includeDuplicates
    ? records
    : records.filter((r) => r.extraction_status !== "duplicate");

  const headers = [
    "business_name",
    "business_id",
    "review_id",
    "source_review_id",
    "source_business_id",
    "author_name",
    "author_profile_url",
    "author_review_count",
    "rating",
    "review_date",
    "review_relative_time",
    "review_text",
    "owner_response_text",
    "owner_response_date",
    "review_url",
    "media_count",
    "source_platform",
    "extraction_status",
    "extraction_timestamp",
    "missing_fields",
    "error_fields",
  ];

  const rows: string[] = [headers.join(",")];

  for (const r of filtered) {
    const row = [
      escapeCsvCell(businessName || "", placeholder),
      escapeCsvCell(r.business_id, placeholder),
      escapeCsvCell(r.review_id, placeholder),
      escapeCsvCell(r.source_review_id, placeholder),
      escapeCsvCell(r.source_business_id, placeholder),
      escapeCsvCell(r.author_name, placeholder),
      escapeCsvCell(r.author_profile_url, placeholder),
      escapeCsvCell(r.author_review_count, placeholder),
      escapeCsvCell(r.rating, placeholder),
      escapeCsvCell(r.review_date, placeholder),
      escapeCsvCell(r.review_relative_time, placeholder),
      escapeCsvCell(r.review_text, placeholder),
      escapeCsvCell(r.owner_response?.text ?? null, placeholder),
      escapeCsvCell(r.owner_response?.date ?? null, placeholder),
      escapeCsvCell(r.review_url, placeholder),
      escapeCsvCell(r.media?.length || 0, placeholder),
      escapeCsvCell(r.source_platform, placeholder),
      escapeCsvCell(r.extraction_status, placeholder),
      escapeCsvCell(r.extraction_timestamp, placeholder),
      escapeCsvCell(r.missing_fields, placeholder),
      escapeCsvCell(r.error_fields, placeholder),
    ];
    rows.push(row.join(","));
  }

  return rows.join("\r\n");
}

/**
 * Serializes Combined Business, Media, and Reviews package into JSON
 */
export function serializeCombinedJson(
  business: Partial<BusinessRecord> | null,
  media: MediaRecord[],
  reviews: ReviewRecord[],
  options: { includeDuplicates?: boolean } = {}
): string {
  const filteredMedia = options.includeDuplicates
    ? media
    : media.filter((m) => m.extraction_status !== "duplicate");

  const filteredReviews = options.includeDuplicates
    ? reviews
    : reviews.filter((r) => r.extraction_status !== "duplicate");

  const businessId = business?.record_id || media[0]?.business_id || reviews[0]?.business_id || "unknown";
  const businessName = business?.business_name || "Unknown Business";

  const payload = {
    export_metadata: {
      format: "business_media_reviews_v1",
      exported_at: new Date().toISOString(),
      business_id: businessId,
      business_name: businessName,
      media_count: filteredMedia.length,
      review_count: filteredReviews.length,
    },
    business: business || null,
    media: filteredMedia,
    reviews: filteredReviews,
  };

  return JSON.stringify(payload, null, 2);
}
