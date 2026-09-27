/**
 * Media & Reviews Repository with Fingerprinting & Atomic Batch Commits
 * Defined in PRD Addendum Section 11, 12, 13.4, 17, and 31
 */

import { MediaRecord } from "../schema/media-record";
import { ReviewRecord } from "../schema/review-record";
import { MediaReviewJob } from "../schema/media-review-job";
import { getDb } from "./db";

/**
 * Strips Google Photos CDN dimensions and crop parameters to obtain a stable fingerprint
 */
export function canonicalizeGoogleMediaUrl(url: string | null | undefined): string {
  if (!url) return "";
  try {
    // Strip =w...-h... or =s... parameter suffixes
    return url.replace(/=w\d+-h\d+.*$/, "").replace(/=s\d+.*$/, "").trim();
  } catch {
    return url.trim();
  }
}

/**
 * Simple deterministic hash for review text deduplication
 */
function hashSnippet(text: string): string {
  const snippet = text.slice(0, 200).trim().toLowerCase();
  let hash = 0;
  for (let i = 0; i < snippet.length; i++) {
    hash = (hash << 5) - hash + snippet.charCodeAt(i);
    hash |= 0;
  }
  return hash.toString(16);
}

/**
 * Computes media fingerprint per PRD Addendum Section 12.1
 */
export function computeMediaFingerprint(media: Partial<MediaRecord>): string {
  if (media.source_media_id) {
    return `src_id:${media.source_media_id}`;
  }
  if (media.media_url) {
    const canonicalUrl = canonicalizeGoogleMediaUrl(media.media_url);
    if (canonicalUrl) return `url:${canonicalUrl}`;
  }
  if (media.embed_url && media.embed_url !== "unavailable") {
    return `embed:${media.embed_url}`;
  }
  if (media.source_url) {
    return `source:${media.source_url}|${media.source_context || "unknown"}`;
  }
  return `media_id:${media.media_id || ""}`;
}

/**
 * Computes review fingerprint per PRD Addendum Section 13.4
 */
export function computeReviewFingerprint(review: Partial<ReviewRecord>): string {
  if (review.source_review_id) {
    return `src_id:${review.source_review_id}`;
  }
  const snippetHash = hashSnippet(review.review_text || "");
  if (review.author_profile_url && review.author_profile_url.length > 5) {
    return `author_url:${review.author_profile_url}|${review.review_date || review.review_relative_time || ""}|${snippetHash}`;
  }
  return `author_name:${(review.author_name || "").toLowerCase().trim()}|${review.review_relative_time || ""}|${snippetHash}`;
}

// ==========================================
// MediaReviewJob Storage Operations
// ==========================================

export async function saveMediaReviewJob(job: MediaReviewJob): Promise<void> {
  const db = await getDb();
  job.updatedAt = new Date().toISOString();
  await db.put("media_review_jobs", job);
}

export async function getMediaReviewJob(jobId: string): Promise<MediaReviewJob | undefined> {
  const db = await getDb();
  return db.get("media_review_jobs", jobId);
}

export async function getMediaReviewJobByBusiness(businessId: string): Promise<MediaReviewJob | undefined> {
  const db = await getDb();
  const index = db.transaction("media_review_jobs", "readonly").store.index("businessId");
  const matches = await index.getAll(IDBKeyRange.only(businessId));
  return matches.length > 0 ? matches[matches.length - 1] : undefined;
}

export async function getAllMediaReviewJobs(): Promise<MediaReviewJob[]> {
  const db = await getDb();
  return db.getAll("media_review_jobs");
}

export async function deleteMediaReviewJob(jobId: string): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(["media_review_jobs", "media_records", "review_records"], "readwrite");
  const job = await tx.objectStore("media_review_jobs").get(jobId);
  if (job) {
    const businessId = job.businessId;
    // Delete media
    const mediaIdx = tx.objectStore("media_records").index("businessId");
    const mediaItems = await mediaIdx.getAll(IDBKeyRange.only(businessId));
    for (const m of mediaItems) {
      await tx.objectStore("media_records").delete(m.media_id);
    }
    // Delete reviews
    const reviewIdx = tx.objectStore("review_records").index("businessId");
    const reviewItems = await reviewIdx.getAll(IDBKeyRange.only(businessId));
    for (const r of reviewItems) {
      await tx.objectStore("review_records").delete(r.review_id);
    }
    await tx.objectStore("media_review_jobs").delete(jobId);
  }
  await tx.done;
}

// ==========================================
// Media Records Batched Commit & Lookups
// ==========================================

export async function saveMediaRecordsBatch(
  businessId: string,
  items: MediaRecord[]
): Promise<{ saved: number; duplicates: number }> {
  if (items.length === 0) return { saved: 0, duplicates: 0 };

  const db = await getDb();
  const tx = db.transaction("media_records", "readwrite");
  const store = tx.store;
  const fpIndex = store.index("canonicalFingerprint");

  let savedCount = 0;
  let dupCount = 0;

  for (const item of items) {
    const fp = computeMediaFingerprint(item);
    item.canonicalFingerprint = fp;

    // Check duplicate in same business
    const existingMatches = await fpIndex.getAll(IDBKeyRange.only(fp));
    const isDup = existingMatches.some((m) => m.business_id === businessId);

    if (isDup) {
      dupCount++;
      // Apply fill-gaps merge to existing item
      const existing = existingMatches.find((m) => m.business_id === businessId);
      if (existing) {
        let modified = false;
        if (!existing.media_url && item.media_url) { existing.media_url = item.media_url; modified = true; }
        if (existing.embed_url === "unavailable" && item.embed_url && item.embed_url !== "unavailable") {
          existing.embed_url = item.embed_url;
          modified = true;
        }
        if (!existing.title && item.title) { existing.title = item.title; modified = true; }
        if (!existing.caption && item.caption) { existing.caption = item.caption; modified = true; }
        if (modified) {
          await store.put(existing);
        }
      }
    } else {
      await store.put(item);
      savedCount++;
    }
  }

  await tx.done;
  return { saved: savedCount, duplicates: dupCount };
}

export async function getMediaByBusiness(businessId?: string): Promise<MediaRecord[]> {
  const db = await getDb();
  if (!businessId || businessId === "all") {
    return db.getAll("media_records");
  }
  const index = db.transaction("media_records", "readonly").store.index("businessId");
  return index.getAll(IDBKeyRange.only(businessId));
}

export async function getMediaByReview(reviewId: string): Promise<MediaRecord[]> {
  const db = await getDb();
  const index = db.transaction("media_records", "readonly").store.index("reviewId");
  return index.getAll(IDBKeyRange.only(reviewId));
}

// ==========================================
// Review Records Batched Commit & Lookups
// ==========================================

export async function saveReviewRecordsBatch(
  businessId: string,
  items: ReviewRecord[]
): Promise<{ saved: number; duplicates: number }> {
  if (items.length === 0) return { saved: 0, duplicates: 0 };

  const db = await getDb();
  const tx = db.transaction(["review_records", "media_records"], "readwrite");
  const reviewStore = tx.objectStore("review_records");
  const mediaStore = tx.objectStore("media_records");
  const fpIndex = reviewStore.index("reviewFingerprint");

  let savedCount = 0;
  let dupCount = 0;

  for (const item of items) {
    const fp = computeReviewFingerprint(item);
    item.reviewFingerprint = fp;

    // Check duplicate in same business
    const existingMatches = await fpIndex.getAll(IDBKeyRange.only(fp));
    const isDup = existingMatches.some((m) => m.business_id === businessId);

    if (isDup) {
      dupCount++;
      // Fill gaps (e.g. if new item has owner_response or more expanded review_text)
      const existing = existingMatches.find((m) => m.business_id === businessId);
      if (existing) {
        let modified = false;
        if ((!existing.owner_response || !existing.owner_response.text) && item.owner_response) {
          existing.owner_response = item.owner_response;
          modified = true;
        }
        if (item.review_text.length > existing.review_text.length) {
          existing.review_text = item.review_text;
          modified = true;
        }
        if (modified) {
          await reviewStore.put(existing);
        }
      }
    } else {
      await reviewStore.put(item);
      savedCount++;

      // Also persist review-attached media items into media_records
      if (item.media && item.media.length > 0) {
        for (const m of item.media) {
          m.canonicalFingerprint = computeMediaFingerprint(m);
          await mediaStore.put(m);
        }
      }
    }
  }

  await tx.done;
  return { saved: savedCount, duplicates: dupCount };
}

export async function getReviewsByBusiness(businessId?: string): Promise<ReviewRecord[]> {
  const db = await getDb();
  if (!businessId || businessId === "all") {
    return db.getAll("review_records");
  }
  const index = db.transaction("review_records", "readonly").store.index("businessId");
  return index.getAll(IDBKeyRange.only(businessId));
}

export {
  saveMediaRecordsBatch as batchSaveMediaRecords,
  saveReviewRecordsBatch as batchSaveReviewRecords,
  getMediaByBusiness as getMediaRecordsByBusiness,
  getReviewsByBusiness as getReviewRecordsByBusiness,
};
