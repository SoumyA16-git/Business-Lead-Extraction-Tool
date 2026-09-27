/**
 * Rating, Review Count, and Price Level Extractor
 * Defined in PRD Section 10
 */

import { PriceLevel } from "../../../core/schema/business-record";
import { getDetailPanel, isInsideFeed } from "./panel-helper";

export interface RatingResult {
  rating: number | null;
  reviewCount: number | null;
  priceLevel: PriceLevel;
}

export function extractRatingAndReviews(doc: Document): RatingResult {
  let rating: number | null = null;
  let reviewCount: number | null = null;
  let priceLevel: PriceLevel = null;

  const panel = getDetailPanel(doc);
  const container = panel || doc;

  // 1. Check aria-label with stars, e.g. "4.6 stars 212 Reviews"
  const starEls = container.querySelectorAll('[aria-label*="star" i]');
  for (const el of Array.from(starEls)) {
    if (isInsideFeed(el)) continue;
    const label = el.getAttribute("aria-label") || "";
    const ratingMatch = label.match(/(\d+\.?\d*)\s*stars?/i);
    if (ratingMatch) {
      const parsed = parseFloat(ratingMatch[1]);
      if (!isNaN(parsed) && parsed > 0 && parsed <= 5) {
        rating = parsed;
        const revMatch = label.match(/(\d[\d,]*)\s*reviews?/i);
        if (revMatch) {
          const c = parseInt(revMatch[1].replace(/,/g, ""), 10);
          if (!isNaN(c)) reviewCount = c;
        }
        break;
      }
    }
  }

  // 2. Fallback: visual numeral rating
  if (rating === null && panel) {
    const numEls = panel.querySelectorAll(
      'span[class*="fontHeadlineMedium"], div[class*="fontDisplayLarge"], span.ceNzKf, span[aria-hidden="true"]'
    );
    for (const el of Array.from(numEls)) {
      if (isInsideFeed(el)) continue;
      const text = el.textContent?.trim() || "";
      const match = text.match(/^(\d\.\d)$/);
      if (match) {
        const parsed = parseFloat(match[1]);
        if (!isNaN(parsed) && parsed >= 1 && parsed <= 5) {
          rating = parsed;
          break;
        }
      }
    }
  }

  // 3. Extract review count, e.g. "(212)" or "212 reviews"
  if (reviewCount === null) {
    const reviewEls = container.querySelectorAll('[aria-label*="review" i], button[aria-label*="review" i]');
    for (const el of Array.from(reviewEls)) {
      if (isInsideFeed(el)) continue;
      const text = el.getAttribute("aria-label") || el.textContent || "";
      const match = text.match(/(\d[\d,]*)\s*reviews?/i);
      if (match) {
        const count = parseInt(match[1].replace(/,/g, ""), 10);
        if (!isNaN(count)) {
          reviewCount = count;
          break;
        }
      }
    }
  }

  if (reviewCount === null && panel) {
    const parenMatches = panel.querySelectorAll('span, button');
    for (const span of Array.from(parenMatches)) {
      if (isInsideFeed(span)) continue;
      const text = span.textContent?.trim() || "";
      const match = text.match(/^\((\d[\d,]*)\)$/);
      if (match) {
        const count = parseInt(match[1].replace(/,/g, ""), 10);
        if (!isNaN(count)) {
          reviewCount = count;
          break;
        }
      }
    }
  }

  // 4. Extract price level
  const priceMatches = container.querySelectorAll('span[aria-label*="Price" i]');
  for (const el of Array.from(priceMatches)) {
    if (isInsideFeed(el)) continue;
    const text = el.textContent || el.getAttribute("aria-label") || "";
    if (text.includes("$$$$") || text.includes("₹₹₹₹")) priceLevel = "$$$$";
    else if (text.includes("$$$") || text.includes("₹₹₹")) priceLevel = "$$$";
    else if (text.includes("$$") || text.includes("₹₹")) priceLevel = "$$";
    else if (text.includes("$") || text.includes("₹")) priceLevel = "$";
    if (priceLevel) break;
  }

  return { rating, reviewCount, priceLevel };
}
