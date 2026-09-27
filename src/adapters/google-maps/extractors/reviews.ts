/**
 * Google Maps Business Reviews Extractor
 * Defined in PRD Addendum Section 13, 14, 15
 */

import { RawMediaItem } from "../../../core/schema/media-record";
import { RawReviewItem, ReviewOwnerResponse } from "../../../core/schema/review-record";
import { isUploadOrContributionButton } from "../navigation";
import { extractMediaUrlFromElement } from "./media";
import { isInsideFeed } from "./panel-helper";

/**
 * Computes an estimated ISO 8601 UTC date from Google Maps relative string
 */
export function computeDateFromRelative(relative: string): string {
  if (!relative) return "";
  const now = new Date();
  const lower = relative.toLowerCase().trim();

  const daysMatch = lower.match(/(\d+)\s*day/);
  if (daysMatch) {
    now.setDate(now.getDate() - parseInt(daysMatch[1], 10));
    return now.toISOString();
  }

  const weeksMatch = lower.match(/(\d+)\s*week/);
  if (weeksMatch) {
    now.setDate(now.getDate() - parseInt(weeksMatch[1], 10) * 7);
    return now.toISOString();
  }

  const monthsMatch = lower.match(/(\d+)\s*month/);
  if (monthsMatch) {
    now.setMonth(now.getMonth() - parseInt(monthsMatch[1], 10));
    return now.toISOString();
  }

  const yearsMatch = lower.match(/(\d+)\s*year/);
  if (yearsMatch) {
    now.setFullYear(now.getFullYear() - parseInt(yearsMatch[1], 10));
    return now.toISOString();
  }

  if (lower.includes("yesterday")) {
    now.setDate(now.getDate() - 1);
    return now.toISOString();
  }

  return "";
}

/**
 * Checks if a button is an action menu / options / contribution button that should NOT be clicked for text expansion
 */
export function isActionMenuOrKebabButton(el: Element): boolean {
  if (isUploadOrContributionButton(el)) return true;
  const ariaLabel = (el.getAttribute("aria-label") || "").toLowerCase().trim();
  const jsaction = (el.getAttribute("jsaction") || "").toLowerCase().trim();
  const hasPopup = (el.getAttribute("aria-haspopup") || "").toLowerCase().trim();

  if (hasPopup === "menu" || hasPopup === "true") return true;
  if (
    ariaLabel.includes("action") ||
    ariaLabel.includes("option") ||
    ariaLabel.includes("menu") ||
    ariaLabel.includes("report") ||
    ariaLabel.includes("share") ||
    ariaLabel.includes("flag") ||
    ariaLabel.includes("like") ||
    ariaLabel.includes("helpful")
  ) {
    return true;
  }
  if (
    jsaction.includes("actionmenu") ||
    jsaction.includes("menu") ||
    jsaction.includes("share") ||
    jsaction.includes("like") ||
    jsaction.includes("helpful")
  ) {
    return true;
  }

  return false;
}

/**
 * Expands truncated review text by clicking the "More" text expander button if present.
 * Uses bounded fast polling and strictly avoids kebab 3-dots action menus.
 */
export async function expandReviewText(reviewCard: Element, timeoutMs = 150): Promise<void> {
  const buttons = Array.from(
    reviewCard.querySelectorAll<HTMLElement>("button, span[role='button']")
  );
  let moreBtn: HTMLElement | null = null;

  for (const b of buttons) {
    if (isActionMenuOrKebabButton(b)) continue;

    const t = b.textContent?.trim().toLowerCase() || "";
    const aria = (b.getAttribute("aria-label") || "").toLowerCase().trim();
    const cls = b.className || "";

    const isClassMatch =
      typeof cls === "string" && (cls.includes("w8nwRe") || cls.includes("kJ3Ndf"));
    const isTextMatch = t === "more" || t === "see more" || t === "read more" || t === "show more";
    const isAriaMatch =
      aria === "more" || aria === "see more" || aria === "read more" || aria === "show more";
    const isJsactionMatch = (b.getAttribute("jsaction") || "")
      .toLowerCase()
      .includes("review.expand");

    if (isClassMatch || isTextMatch || isAriaMatch || isJsactionMatch) {
      moreBtn = b;
      break;
    }
  }

  if (!moreBtn) return;

  const textContainer = reviewCard.querySelector(
    'span.wiI7pd, div[class*="wiI7pd"], div.wiI7fc, span.wiI7fc'
  );
  const prevLen = textContainer?.textContent?.length || 0;

  try {
    moreBtn.click();
  } catch {
    return;
  }

  // Fast bounded non-blocking wait for expanded text to settle
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const curLen = textContainer?.textContent?.length || 0;
    if (curLen > prevLen) break;
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
}

/**
 * Extracts all currently rendered review items from the page with per-card isolation
 */
export async function extractReviewsFromPage(
  doc: Document,
  expandTruncated = true
): Promise<RawReviewItem[]> {
  const reviewCards = doc.querySelectorAll(
    'div.jftiEf, div[data-review-id], div[class*="jftiEf"], div[role="region"][aria-label*="Reviews" i] div[class*="jftiEf"], div.m6QErb div.jftiEf'
  );
  const items: RawReviewItem[] = [];
  const seenIds = new Set<string>();

  for (const card of Array.from(reviewCards)) {
    if (isInsideFeed(card)) continue;

    try {
      const sourceReviewId = card.getAttribute("data-review-id") || null;
      const authorEl = card.querySelector(
        'div.d4r55, div[class*="d4r55"], button[class*="al6Kxe"]'
      );
      const authorName = authorEl?.textContent?.trim() || "Google User";

      const linkEl = card.querySelector('a[href*="/contrib/"]') as HTMLAnchorElement | null;
      const authorProfileUrl = linkEl?.href || "";

      // Rating
      let rating = 5;
      const starEl = card.querySelector('span[role="img"][aria-label*="star" i], span.kvMYJc');
      if (starEl) {
        const label = starEl.getAttribute("aria-label") || "";
        const m = label.match(/(\d+\.?\d*)\s*stars?/i);
        if (m) rating = parseFloat(m[1]);
      }

      // Expand text if requested
      if (expandTruncated) {
        await expandReviewText(card);
      }

      // Review text
      const textEl = card.querySelector(
        'span.wiI7pd, div[class*="wiI7pd"], span.wiI7fc, div[class*="wiI7fc"], span[class*="review-snippet"]'
      );
      const reviewText = textEl?.textContent?.trim() || "";

      // Relative date & computed date
      const dateEl = card.querySelector('span.rsqaWe, span[class*="rsqaWe"]');
      const reviewRelativeTime = dateEl?.textContent?.trim() || "";
      const reviewDate = computeDateFromRelative(reviewRelativeTime);

      // Review count for author
      let authorReviewCount: number | null = null;
      const countEl = card.querySelector('div.RfnDt, span[class*="RfnDt"]');
      if (countEl) {
        const m = countEl.textContent?.match(/(\d[\d,]*)\s*review/i);
        if (m) authorReviewCount = parseInt(m[1].replace(/,/g, ""), 10);
      }

      // Owner response
      let ownerResponse: ReviewOwnerResponse | null = null;
      const responseEl = card.querySelector('div.CDe7pd, div[class*="CDe7pd"]');
      if (responseEl) {
        const respTextEl = responseEl.querySelector(
          'div.wiI7pd, div[class*="wiI7pd"], span.wiI7pd'
        );
        const respDateEl = responseEl.querySelector('span.DHIhFt, span[class*="DHIhFt"]');
        if (respTextEl?.textContent) {
          ownerResponse = {
            text: respTextEl.textContent.trim(),
            date: respDateEl?.textContent?.trim() || "",
          };
        }
      }

      // Review attached media (photos)
      const reviewMedia: RawMediaItem[] = [];
      const mediaNodes = card.querySelectorAll(
        'button[jsaction*="review.photo"], div.Tya61d, div[class*="Tya61d"], div.CDe7pd button, button[style*="background-image"], div[style*="background-image"][aria-label*="photo" i]'
      );
      for (const mNode of Array.from(mediaNodes)) {
        if (isUploadOrContributionButton(mNode)) continue;
        const { mediaUrl, thumbnailUrl } = extractMediaUrlFromElement(mNode);
        if (mediaUrl) {
          reviewMedia.push({
            type: "photo",
            sourceUrl: window.location.href,
            mediaUrl,
            embedUrl: "",
            thumbnailUrl,
            title: "",
            caption: "",
            width: null,
            height: null,
            duration: null,
            sourceContext: "review_media",
          });
        }
      }

      // Deduplication check in current batch
      const dedupeKey =
        sourceReviewId || `${authorName}|${reviewRelativeTime}|${reviewText.slice(0, 50)}`;
      if (seenIds.has(dedupeKey)) continue;
      seenIds.add(dedupeKey);

      items.push({
        sourceReviewId,
        authorName,
        authorProfileUrl,
        authorReviewCount,
        rating,
        reviewText,
        reviewDate,
        reviewRelativeTime,
        reviewUrl: "",
        language: "en",
        ownerResponse,
        media: reviewMedia,
      });
    } catch (cardErr) {
      console.debug("[ReviewExtractor] Error parsing individual review card:", cardErr);
    }
  }

  return items;
}

/**
 * Clicks the "More reviews" or "See all reviews" button if visible on the page.
 * This expands the full reviews list from the business summary card.
 * Returns true if clicked, false if not found.
 */
export async function clickMoreReviewsButton(doc: Document): Promise<boolean> {
  // Multiple selector patterns for different Maps layouts
  const candidates = [
    // "More reviews" button on business profile
    ...Array.from(doc.querySelectorAll<HTMLElement>('button[aria-label*="More reviews" i]')),
    ...Array.from(doc.querySelectorAll<HTMLElement>('button[aria-label*="See all reviews" i]')),
    ...Array.from(doc.querySelectorAll<HTMLElement>('button[jsaction*="moreReviews" i]')),
    ...Array.from(doc.querySelectorAll<HTMLElement>('button[jsaction*="pane.rating" i]')),
    ...Array.from(doc.querySelectorAll<HTMLElement>('div.F7nice button, div.jANrlb button')),
    // Text match fallback
    ...Array.from(doc.querySelectorAll<HTMLElement>('button, div[role="button"]')).filter((b) => {
      const t = b.textContent?.trim().toLowerCase() || "";
      return (
        t === "more reviews" ||
        t === "see all reviews" ||
        t === "view all reviews" ||
        (t.startsWith("see all") && t.includes("review")) ||
        (t.includes("reviews") && !t.includes("write") && !t.includes("rate"))
      );
    }),
  ];

  for (const btn of candidates) {
    if (btn && btn.offsetParent !== null && !isInsideFeed(btn) && !isUploadOrContributionButton(btn)) {
      try {
        btn.scrollIntoView?.({ behavior: "instant" as ScrollBehavior, block: "center" });
      } catch {
        // Ignore in headless / jsdom environments
      }
      btn.click();
      await new Promise((resolve) => setTimeout(resolve, 500));
      return true;
    }
  }

  return false;
}

/**
 * Scrolls the active Google Maps review list container to load more reviews.
 * Returns false when the feed is genuinely exhausted (scroll position didn't change).
 */
export async function scrollReviews(doc: Document): Promise<boolean> {
  // 1. If a review item already exists, find its scrollable ancestor
  const existingCard = doc.querySelector('div.jftiEf, div[data-review-id]');
  if (existingCard) {
    let p: HTMLElement | null = existingCard.parentElement;
    while (p && p !== doc.body && p !== doc.documentElement) {
      if (p.scrollHeight > p.clientHeight && p.clientHeight > 100) {
        const prevHeight = p.scrollHeight;
        const prevTop = p.scrollTop;
        const atBottom = p.scrollTop + p.clientHeight >= p.scrollHeight - 10;

        p.scrollBy({ top: 1200, behavior: "smooth" });
        await new Promise((resolve) => setTimeout(resolve, 1000));

        const newHeight = p.scrollHeight;
        const newTop = p.scrollTop;

        if (newHeight > prevHeight || newTop > prevTop + 10) return true;
        if (atBottom) return false;
        return true;
      }
      p = p.parentElement;
    }
  }

  // 2. Fallback to known container selectors
  const scrollable =
    (doc.querySelector('div.m6QErb.DxyBCb.kA9KIf.dS8AEf') as HTMLElement | null) ||
    (doc.querySelector('div.m6QErb[aria-label*="Reviews" i]') as HTMLElement | null) ||
    (doc.querySelector('div[role="region"][aria-label*="Reviews" i] div.m6QErb') as HTMLElement | null) ||
    (doc.querySelector('div.m6QErb.XiKgde') as HTMLElement | null) ||
    (doc.querySelector('div[tabindex="-1"].m6QErb') as HTMLElement | null);

  if (scrollable) {
    const prevHeight = scrollable.scrollHeight;
    const prevTop = scrollable.scrollTop;
    const atBottom = scrollable.scrollTop + scrollable.clientHeight >= scrollable.scrollHeight - 10;

    scrollable.scrollBy({ top: 1200, behavior: "smooth" });
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const newHeight = scrollable.scrollHeight;
    const newTop = scrollable.scrollTop;

    if (newHeight > prevHeight || newTop > prevTop + 20) return true;
    if (atBottom) return false;
    return true;
  }

  window.scrollBy({ top: 800, behavior: "smooth" });
  await new Promise((resolve) => setTimeout(resolve, 700));
  return true;
}

export {
  extractReviewsFromPage as extractReviews,
  scrollReviews as scrollReviewsFeed,
};

