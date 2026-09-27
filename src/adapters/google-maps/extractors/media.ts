/**
 * Google Maps Business Media (Photos & Videos) Extractor
 * Defined in PRD Addendum Section 8, 9, 10, 11
 */

import { MediaSourceContext, RawMediaItem } from "../../../core/schema/media-record";
import { canonicalizeGoogleMediaUrl } from "../../../core/storage/media-reviews-repo";
import { isUploadOrContributionButton } from "../navigation";
import { isInsideFeed } from "./panel-helper";

/**
 * Extracts high-resolution direct media URL from Google Maps photo element
 */
export function extractMediaUrlFromElement(el: Element): { mediaUrl: string; thumbnailUrl: string } {
  let rawUrl = "";
  let thumbUrl = "";

  // 1. Direct <img> tag
  const img = (el.tagName.toLowerCase() === "img" ? el : el.querySelector("img")) as HTMLImageElement | null;
  if (img) {
    rawUrl = img.src || img.getAttribute("data-src") || "";
    thumbUrl = img.src || "";
  }

  // 2. CSS background-image
  if (!rawUrl) {
    const bgEl =
      el.querySelector('[style*="background-image"]') ||
      (el.getAttribute("style")?.includes("background-image") ? el : null);
    if (bgEl) {
      const style = bgEl.getAttribute("style") || "";
      const match = style.match(/url\(["']?([^"']+)["']?\)/i);
      if (match) {
        rawUrl = match[1];
        thumbUrl = match[1];
      }
    }
  }

  if (!rawUrl) return { mediaUrl: "", thumbnailUrl: "" };

  // Generate high-resolution asset URL by stripping small dimensions
  let mediaUrl = rawUrl;
  if (rawUrl.includes("googleusercontent.com") || rawUrl.includes("ggpht.com")) {
    if (/=w\d+-h\d+/.test(rawUrl)) {
      mediaUrl = rawUrl.replace(/=w\d+-h\d+.*$/, "=w1920-h1080-k-no");
    } else if (/=s\d+/.test(rawUrl)) {
      mediaUrl = rawUrl.replace(/=s\d+.*$/, "=s1920");
    } else if (/=w\d+/.test(rawUrl)) {
      mediaUrl = rawUrl.replace(/=w\d+.*$/, "=w1920-k-no");
    } else {
      mediaUrl = canonicalizeGoogleMediaUrl(rawUrl);
    }
  }

  return { mediaUrl, thumbnailUrl: thumbUrl };
}

/**
 * Detects if an element represents a video rather than a static photo
 */
export function isVideoElement(el: Element): { isVideo: boolean; duration: number | null } {
  let isVideo = false;
  let duration: number | null = null;

  if (el.querySelector('video, [aria-label*="play" i], [class*="play" i]')) {
    isVideo = true;
  }

  // Look for timestamp/duration string (e.g. "0:45" or "1:32")
  const text = el.textContent || "";
  const durationMatch = text.match(/\b(\d+):(\d{2})\b/);
  if (durationMatch) {
    isVideo = true;
    const minutes = parseInt(durationMatch[1], 10);
    const seconds = parseInt(durationMatch[2], 10);
    duration = minutes * 60 + seconds;
  }

  return { isVideo, duration };
}

/**
 * Extracts public photo and video items rendered in the Google Maps gallery or profile
 */
export function extractMediaFromGallery(
  doc: Document,
  context: MediaSourceContext = "business_gallery"
): RawMediaItem[] {
  const items: RawMediaItem[] = [];
  const seenUrls = new Set<string>();

  // Candidates: gallery buttons, anchor photo tiles, video tiles, or image containers
  const candidateSelectors = [
    'button[data-photo-index]',
    'a[data-photo-index]',
    'div[data-photo-index]',
    'div.U39Pmb',
    'div.m6QErb div.ofKBgf',
    'div[jsaction*="photo"]',
    'button[jsaction*="photo"]',
    'div[role="img"][aria-label]',
    'div[role="button"][aria-label*="photo" i]',
    'div[role="button"][aria-label*="video" i]',
    'button[aria-label*="photo" i]',
    'button[aria-label*="video" i]',
    'img[src*="googleusercontent.com"]',
    'img[src*="ggpht.com"]',
    'div[style*="background-image"]',
  ];

  const galleryRegion =
    doc.querySelector('div[role="region"][aria-label*="photo" i]') ||
    doc.querySelector('div[role="region"][aria-label*="media" i]') ||
    doc.querySelector('div.m6QErb[aria-label*="photo" i]') ||
    doc;

  const tiles = galleryRegion.querySelectorAll(candidateSelectors.join(", "));

  for (const tile of Array.from(tiles)) {
    // Exclude tiles located inside search feed or contribution/upload buttons
    if (isInsideFeed(tile) || isUploadOrContributionButton(tile)) continue;

    const { mediaUrl, thumbnailUrl } = extractMediaUrlFromElement(tile);
    if (!mediaUrl || seenUrls.has(mediaUrl)) continue;
    seenUrls.add(mediaUrl);

    const { isVideo, duration } = isVideoElement(tile);

    // Extract title / caption if available
    const captionEl = tile.querySelector('[aria-label], img[alt]');
    const title =
      tile.getAttribute("aria-label") ||
      tile.getAttribute("alt") ||
      captionEl?.getAttribute("aria-label") ||
      captionEl?.getAttribute("alt") ||
      "";

    // Platform-native source media ID
    const sourceMediaId = tile.getAttribute("data-photo-index") || null;

    items.push({
      sourceMediaId,
      type: isVideo ? "video" : "photo",
      sourceUrl: window.location.href,
      mediaUrl,
      embedUrl: "",
      thumbnailUrl,
      title: title.trim(),
      caption: title.trim(),
      width: null,
      height: null,
      duration,
      sourceContext: context,
    });
  }

  // Fallback: If no gallery tile matches were found, check the hero / cover photo on profile
  if (items.length === 0) {
    const heroImg = doc.querySelector(
      'button[jsaction*="heroHeader"] img, div[class*="hero"] img'
    ) as HTMLImageElement | null;
    if (heroImg && !isInsideFeed(heroImg) && !isUploadOrContributionButton(heroImg.parentElement)) {
      const { mediaUrl, thumbnailUrl } = extractMediaUrlFromElement(heroImg);
      if (mediaUrl) {
        items.push({
          sourceMediaId: null,
          type: "photo",
          sourceUrl: window.location.href,
          mediaUrl,
          embedUrl: "",
          thumbnailUrl,
          title: "Profile Cover Photo",
          caption: "Cover photo",
          width: null,
          height: null,
          duration: null,
          sourceContext: "business_profile",
        });
      }
    }
  }

  return items;
}

/**
 * Scrolls the active Google Maps media gallery container to load more items
 */
export async function scrollGallery(doc: Document): Promise<boolean> {
  const scrollable =
    (doc.querySelector('div[role="region"][aria-label*="photo" i] div.m6QErb') as HTMLElement | null) ||
    (doc.querySelector('div.m6QErb[aria-label*="photo" i]') as HTMLElement | null) ||
    (doc.querySelector('div[tabindex="-1"].m6QErb') as HTMLElement | null);

  if (scrollable) {
    const prevHeight = scrollable.scrollHeight;
    const prevTop = scrollable.scrollTop;
    scrollable.scrollBy({ top: 1000, behavior: "smooth" });
    await new Promise((resolve) => setTimeout(resolve, 800));
    return scrollable.scrollHeight > prevHeight || scrollable.scrollTop > prevTop;
  }

  window.scrollBy({ top: 800, behavior: "smooth" });
  await new Promise((resolve) => setTimeout(resolve, 600));
  return true;
}

export {
  extractMediaFromGallery as extractMediaItems,
  scrollGallery as scrollMediaGallery,
  canonicalizeGoogleMediaUrl as normalizeGooglePhotosUrl,
};

