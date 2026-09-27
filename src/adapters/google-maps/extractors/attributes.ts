/**
 * Business Status, Service Options, Attributes, and Description Extractor
 * Defined in PRD Section 10
 */

import { BusinessStatus } from "../../../core/schema/business-record";
import { getDetailPanel, isInsideFeed } from "./panel-helper";

export interface AttributesResult {
  businessStatus: BusinessStatus;
  serviceOptions: string[];
  attributes: string[];
  description: string | null;
}

export function extractAttributes(doc: Document): AttributesResult {
  let businessStatus: BusinessStatus = "operational";
  const serviceOptions: string[] = [];
  const attributes: string[] = [];
  let description: string | null = null;

  const panel = getDetailPanel(doc);
  const mainPanel = panel || doc.querySelector('div[role="main"]') || doc.body;
  const panelText = mainPanel?.textContent || "";

  // 1. Detect closure banners strictly inside detail panel
  if (/permanently closed/i.test(panelText) || mainPanel.querySelector('[aria-label*="Permanently closed" i]')) {
    businessStatus = "closed_permanently";
  } else if (/temporarily closed/i.test(panelText) || mainPanel.querySelector('[aria-label*="Temporarily closed" i]')) {
    businessStatus = "closed_temporarily";
  }

  // 2. Editorial description / summary
  const descEl =
    mainPanel.querySelector('div[class*="fontBodyMedium"] [aria-hidden="true"]') ||
    mainPanel.querySelector('div[class*="editorial"]') ||
    mainPanel.querySelector('[data-attrid="description"]');
  if (descEl && !isInsideFeed(descEl) && descEl.textContent) {
    const text = descEl.textContent.trim();
    if (text.length > 20 && !text.includes("★")) {
      description = text;
    }
  }

  // 3. Service options & attributes (pills, badges, accessible tags)
  const chips = mainPanel.querySelectorAll('div[aria-label*="Service options" i] span, div[class*="fontBodyMedium"] span');
  for (const chip of Array.from(chips)) {
    if (isInsideFeed(chip)) continue;
    const text = chip.textContent?.trim();
    if (text && text.length > 3 && text.length < 40) {
      if (/dine-in|takeout|delivery|curbside|online|appointment/i.test(text)) {
        if (!serviceOptions.includes(text)) serviceOptions.push(text);
      } else if (/wheelchair|wi-fi|restroom|parking|credit card/i.test(text)) {
        if (!attributes.includes(text)) attributes.push(text);
      }
    }
  }

  return { businessStatus, serviceOptions, attributes, description };
}
