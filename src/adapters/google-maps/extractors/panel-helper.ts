/**
 * Helper to locate the active business detail panel on Google Maps
 * and ensure elements from the search results feed are strictly excluded.
 *
 * Google Maps uses obfuscated CSS class names (e.g. DUwDvf, lfPIob) that
 * rotate with frontend deployments. This function uses multiple fallback
 * strategies so extraction keeps working even when class names change.
 */

export function getDetailPanel(doc: Document): Element | null {
  if (!doc) return null;

  // Strategy 1: Stable class names — DUwDvf and lfPIob have been stable,
  // but also try fontHeadlineLarge which is a semantic utility class.
  const headingSelectors = [
    'h1.DUwDvf',
    'h1[class*="DUwDvf"]',
    'h1[class*="lfPIob"]',
    'h1[class*="fontHeadlineLarge"]',
    'h1[class*="fontDisplayLarge"]',
    'h1[class*="fontHeadline"]',
  ];

  for (const sel of headingSelectors) {
    const heading = doc.querySelector(sel);
    if (!heading) continue;

    let current: Element | null = heading.parentElement;
    let bestPanel: Element | null = null;
    while (current && current !== doc.body && current !== doc.documentElement) {
      if (current.querySelector('div[role="feed"]')) break;
      bestPanel = current;
      if (
        current.classList?.contains("bJzME") ||
        current.classList?.contains("TI60gf") ||
        current.getAttribute("role") === "region"
      ) {
        return current;
      }
      current = current.parentElement;
    }
    if (bestPanel) return bestPanel;
  }

  // Strategy 2: Any h1 on the page that isn't inside the search results feed
  // and whose text doesn't match known search-page headings like "Results"
  const allH1s = doc.querySelectorAll("h1");
  for (const h of Array.from(allH1s)) {
    if (isInsideFeed(h)) continue;
    const text = h.textContent?.trim().toLowerCase() || "";
    const isSearchHeading =
      !text ||
      text === "results" ||
      text.startsWith("results for") ||
      text === "google maps" ||
      text === "search results";
    if (!isSearchHeading) {
      // Walk up to find a suitable container
      let p: Element | null = h.parentElement;
      while (p && p !== doc.body) {
        if (p.querySelector('div[role="feed"]')) break;
        if (p.getAttribute("role") === "region" || p.getAttribute("role") === "main") {
          return p;
        }
        p = p.parentElement;
      }
      // Fallback: return the h1's parent if nothing better found
      if (h.parentElement && !h.parentElement.querySelector('div[role="feed"]')) {
        return h.parentElement;
      }
    }
  }

  // Strategy 3: div[role="main"] that does NOT contain the search results feed
  const mainPanels = doc.querySelectorAll('div[role="main"]');
  for (const p of Array.from(mainPanels)) {
    if (!p.querySelector('div[role="feed"]')) {
      return p;
    }
  }

  return null;
}

/**
 * Checks if an element is contained within the search results feed
 */
export function isInsideFeed(el: Element | null): boolean {
  if (!el) return true;
  return !!el.closest('div[role="feed"]');
}

