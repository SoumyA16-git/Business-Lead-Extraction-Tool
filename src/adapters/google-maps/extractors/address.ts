/**
 * Address Extractor with Layered Fallback Strategies
 * Defined in PRD Section 25.3
 */

import { ExtractorResult } from "./name";
import { getDetailPanel, isInsideFeed } from "./panel-helper";

export function cleanAddress(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let text = raw.trim();
  text = text.replace(/^Address:\s*/i, "");
  // Strip leading non-alphanumeric icon glyphs / symbols
  text = text.replace(/^[^\w\d\s#.,\-/]+/, "").trim();
  return text.length > 3 ? text : null;
}

const ADDRESS_STRATEGIES: Array<(panel: Element) => string | null> = [
  // Strategy 0: button with data-item-id containing address (check aria-label first)
  (panel) => {
    const el = panel.querySelector('button[data-item-id*="address"]');
    if (!el || isInsideFeed(el)) return null;
    const label = el.getAttribute("aria-label");
    if (label) {
      const cleaned = cleanAddress(label);
      if (cleaned) return cleaned;
    }
    return cleanAddress(el.textContent);
  },
  // Strategy 1: aria-label containing Address
  (panel) => {
    const el = panel.querySelector('button[aria-label*="Address:" i]');
    if (!el || isInsideFeed(el)) return null;
    return cleanAddress(el.getAttribute("aria-label") || el.textContent);
  },
  // Strategy 2: element with address tooltip
  (panel) => {
    const el = panel.querySelector('[data-tooltip*="address" i]');
    if (!el || isInsideFeed(el)) return null;
    return cleanAddress(el.getAttribute("data-tooltip") || el.textContent);
  },
  // Strategy 3: any div with aria-label matching address
  (panel) => {
    const el = panel.querySelector('div[aria-label*="Address:" i]');
    if (!el || isInsideFeed(el)) return null;
    return cleanAddress(el.getAttribute("aria-label") || el.textContent);
  },
  // Strategy 4: button with copy address tooltip
  (panel) => {
    const el = panel.querySelector('button[data-tooltip*="Copy address" i]');
    if (!el || isInsideFeed(el)) return null;
    return cleanAddress(el?.textContent);
  },
];

export function extractAddress(doc: Document): ExtractorResult<string | null> {
  const panel = getDetailPanel(doc);
  if (!panel) return { value: null, strategyUsed: -1 };

  for (let i = 0; i < ADDRESS_STRATEGIES.length; i++) {
    const val = ADDRESS_STRATEGIES[i](panel);
    if (val && val.length > 0) {
      return { value: val, strategyUsed: i };
    }
  }
  return { value: null, strategyUsed: -1 };
}
