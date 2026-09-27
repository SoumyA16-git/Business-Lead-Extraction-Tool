/**
 * Category Extractor (Primary & Secondary)
 * Defined in PRD Section 10
 */

import { getDetailPanel, isInsideFeed } from "./panel-helper";

export interface CategoriesResult {
  primaryCategory: string | null;
  secondaryCategories: string[];
}

export function extractCategories(doc: Document): CategoriesResult {
  const categories: string[] = [];
  const panel = getDetailPanel(doc);
  const container = panel || doc;

  // Strategy 0: Buttons with category action strictly inside detail panel
  const categoryButtons = container.querySelectorAll('button[jsaction*="category" i]');
  for (const btn of Array.from(categoryButtons)) {
    if (isInsideFeed(btn)) continue;
    const text = btn.textContent?.trim();
    if (text && !categories.includes(text)) {
      categories.push(text);
    }
  }

  // Strategy 1: Subtitle button next to rating
  if (categories.length === 0) {
    const subButtons = container.querySelectorAll('button[class*="DkEaL"]');
    for (const btn of Array.from(subButtons)) {
      if (isInsideFeed(btn)) continue;
      const text = btn.textContent?.trim();
      if (text && !categories.includes(text)) {
        categories.push(text);
      }
    }
  }

  // Strategy 2: span with category or fontBodyMedium near header
  if (categories.length === 0 && panel) {
    const headerEl = panel.querySelector('h1');
    if (headerEl?.parentElement) {
      const spans = headerEl.parentElement.querySelectorAll('span, button');
      for (const el of Array.from(spans)) {
        if (isInsideFeed(el)) continue;
        const text = el.textContent?.trim() || "";
        // Match common business category strings (e.g. "Dental clinic", "Restaurant")
        if (text && text.length > 2 && text.length < 50 && !/^\d/.test(text) && !text.includes("★")) {
          categories.push(text);
          break;
        }
      }
    }
  }

  const primaryCategory = categories[0] || null;
  const secondaryCategories = categories.slice(1);

  return { primaryCategory, secondaryCategories };
}
