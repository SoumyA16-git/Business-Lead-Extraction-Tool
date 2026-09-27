/**
 * Phone Extractor with Layered Fallback Strategies
 * Defined in PRD Section 25.3
 */

import { ExtractorResult } from "./name";
import { getDetailPanel, isInsideFeed } from "./panel-helper";

export function cleanPhoneNumber(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let text = raw.trim();
  // Strip common prefixes
  text = text.replace(/^Phone:\s*/i, "").replace(/^tel:\s*/i, "");
  // Strip leading icon glyphs or non-digit/non-plus characters (e.g. material icon text or glyphs)
  text = text.replace(/^[^\d+]+/, "");
  // Strip trailing whitespace or non-digit characters
  text = text.replace(/[^\d]+$/, "");
  return text.length >= 6 ? text.trim() : null;
}

const PHONE_STRATEGIES: Array<(panel: Element) => string | null> = [
  // Strategy 0: button with data-item-id containing phone
  (panel) => {
    const el = panel.querySelector('button[data-item-id*="phone"]');
    if (!el || isInsideFeed(el)) return null;
    const label = el.getAttribute("aria-label");
    if (label) {
      const cleaned = cleanPhoneNumber(label);
      if (cleaned) return cleaned;
    }
    const dataId = el.getAttribute("data-item-id") || "";
    const m = dataId.match(/phone:tel:(.+)/);
    if (m) {
      const cleaned = cleanPhoneNumber(m[1]);
      if (cleaned) return cleaned;
    }
    return cleanPhoneNumber(el.textContent);
  },
  // Strategy 1: button with aria-label containing Phone
  (panel) => {
    const el = panel.querySelector('button[aria-label*="Phone:" i]');
    if (!el || isInsideFeed(el)) return null;
    return cleanPhoneNumber(el.getAttribute("aria-label") || el.textContent);
  },
  // Strategy 2: anchor with tel: href
  (panel) => {
    const el = panel.querySelector('a[href^="tel:"]');
    if (!el || isInsideFeed(el)) return null;
    return cleanPhoneNumber(el.getAttribute("href"));
  },
  // Strategy 3: element with data-tooltip containing phone
  (panel) => {
    const el = panel.querySelector('[data-tooltip*="phone" i]');
    if (!el || isInsideFeed(el)) return null;
    return cleanPhoneNumber(el.getAttribute("data-tooltip") || el.textContent);
  },
  // Strategy 4: regex check on action buttons in detail panel
  (panel) => {
    const buttons = panel.querySelectorAll('button');
    for (const btn of Array.from(buttons)) {
      if (isInsideFeed(btn)) continue;
      const text = cleanPhoneNumber(btn.textContent);
      if (text && /^(\+?\d[\d\s\-().]{7,}\d)$/.test(text)) {
        return text;
      }
    }
    return null;
  },
];

export function extractPhone(doc: Document): ExtractorResult<string | null> {
  const panel = getDetailPanel(doc);
  if (!panel) return { value: null, strategyUsed: -1 };

  for (let i = 0; i < PHONE_STRATEGIES.length; i++) {
    const val = PHONE_STRATEGIES[i](panel);
    if (val && val.length > 0) {
      return { value: val, strategyUsed: i };
    }
  }
  return { value: null, strategyUsed: -1 };
}
