/**
 * Opening Hours Extractor
 * Defined in PRD Section 10
 */

import { OpeningHourItem } from "../../../core/schema/business-record";
import { getDetailPanel, isInsideFeed } from "./panel-helper";

const DAYS_OF_WEEK = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export function extractOpeningHours(doc: Document): OpeningHourItem[] | null {
  const items: OpeningHourItem[] = [];
  const panel = getDetailPanel(doc);
  const container = panel || doc;

  // Strategy 0: Standard hours table
  const tableRows = container.querySelectorAll("table tr");
  for (const row of Array.from(tableRows)) {
    if (isInsideFeed(row)) continue;
    const cells = row.querySelectorAll("td, th");
    if (cells.length >= 2) {
      const day = cells[0].textContent?.trim() || "";
      const hours = cells[1].textContent?.trim() || "";
      if (DAYS_OF_WEEK.some((d) => day.toLowerCase().includes(d.toLowerCase())) && hours) {
        items.push({ day, hours });
      }
    }
  }

  // Strategy 1: Aria-label on hours button or panel
  if (items.length === 0) {
    const hoursEl = container.querySelector('[aria-label*="hours" i]');
    if (hoursEl && !isInsideFeed(hoursEl)) {
      const label = hoursEl.getAttribute("aria-label") || "";
      // Sometimes aria-label is like "Open ⋅ Closes 8 PM"
      if (label && !label.includes("hours")) {
        items.push({ day: "Current", hours: label });
      }
    }
  }

  return items.length > 0 ? items : null;
}
