/**
 * Website and Social Links Extractor with Layered Fallback Strategies
 * Defined in PRD Section 11 and 25.3
 */

import { ExtractorResult } from "./name";
import { getDetailPanel, isInsideFeed } from "./panel-helper";

/**
 * Validates that an extracted URL is a genuine business website
 */
export function cleanAndValidateWebsite(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let trimmed = raw.trim();

  // Unwrap relative Google redirect: /url?q=https://...
  if (trimmed.startsWith("/url?")) {
    try {
      const u = new URL(trimmed, "https://www.google.com");
      const q = u.searchParams.get("q") || u.searchParams.get("url");
      if (q) trimmed = decodeURIComponent(q).trim();
    } catch {
      // ignore
    }
  }

  // Unwrap absolute Google redirect: https://www.google.com/url?q=https://...
  if (trimmed.includes("google.") && trimmed.includes("/url?")) {
    try {
      const u = new URL(trimmed);
      const q = u.searchParams.get("q") || u.searchParams.get("url");
      if (q) trimmed = decodeURIComponent(q).trim();
    } catch {
      // ignore
    }
  }

  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
    return null;
  }

  try {
    const u = new URL(trimmed);
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    // Exclude Google-internal domains or generic tools
    const blockedHosts = [
      "google.com",
      "maps.google.com",
      "goo.gl",
      "gstatic.com",
      "google.co.in",
      "google.co.uk",
    ];
    if (blockedHosts.some((b) => host === b || host.endsWith("." + b))) {
      return null;
    }
    return trimmed;
  } catch {
    return null;
  }
}

const WEBSITE_STRATEGIES: Array<(panel: Element) => string | null> = [
  // Strategy 0: anchor with data-item-id authority inside detail panel
  (panel) => {
    const el = panel.querySelector('a[data-item-id*="authority"]');
    if (!el || isInsideFeed(el)) return null;
    return cleanAndValidateWebsite(el.getAttribute("href"));
  },
  // Strategy 1: anchor with website tooltip inside detail panel
  (panel) => {
    const el = panel.querySelector('a[data-tooltip*="website" i]');
    if (!el || isInsideFeed(el)) return null;
    return cleanAndValidateWebsite(el.getAttribute("href"));
  },
  // Strategy 2: anchor with website aria-label inside detail panel
  (panel) => {
    const el = panel.querySelector('a[aria-label*="website" i], button[aria-label*="website" i] a');
    if (!el || isInsideFeed(el)) return null;
    return cleanAndValidateWebsite(el.getAttribute("href"));
  },
  // Strategy 3: button with data-item-id authority enclosing an anchor or data-href
  (panel) => {
    const btn = panel.querySelector('button[data-item-id*="authority"]');
    if (!btn || isInsideFeed(btn)) return null;
    const a = btn.querySelector("a");
    const raw = a?.getAttribute("href") || btn.getAttribute("data-href");
    return cleanAndValidateWebsite(raw);
  },
  // Strategy 4: any anchor linking to external domain in detail panel
  (panel) => {
    const anchors = panel.querySelectorAll('a[href^="http"]');
    for (const a of Array.from(anchors)) {
      if (isInsideFeed(a)) continue;
      const valid = cleanAndValidateWebsite(a.getAttribute("href"));
      if (valid) return valid;
    }
    return null;
  },
];

export function extractWebsiteUrl(doc: Document): ExtractorResult<string | null> {
  const panel = getDetailPanel(doc);
  if (!panel) {
    return { value: null, strategyUsed: -1 };
  }

  for (let i = 0; i < WEBSITE_STRATEGIES.length; i++) {
    const val = WEBSITE_STRATEGIES[i](panel);
    if (val && val.length > 0) {
      return { value: val, strategyUsed: i };
    }
  }
  return { value: null, strategyUsed: -1 };
}

/**
 * Discovers social media profile links rendered on the active Google Maps detail panel
 */
export function extractDiscoveredSocialUrls(doc: Document): string[] {
  const socialDomains = [
    "facebook.com",
    "instagram.com",
    "twitter.com",
    "x.com",
    "linkedin.com",
    "tiktok.com",
    "youtube.com",
    "youtu.be",
    "wa.me",
    "whatsapp.com",
  ];

  const panel = getDetailPanel(doc);
  if (!panel) return [];

  const foundUrls: string[] = [];
  const links = panel.querySelectorAll('a[href]');

  for (const link of Array.from(links)) {
    if (isInsideFeed(link)) continue;
    const href = link.getAttribute("href");
    if (!href) continue;
    try {
      const u = new URL(href);
      const host = u.hostname.replace(/^www\./, "").toLowerCase();
      if (socialDomains.some((d) => host === d || host.endsWith("." + d))) {
        foundUrls.push(href);
      }
    } catch {
      // ignore invalid URLs
    }
  }

  return Array.from(new Set(foundUrls));
}
