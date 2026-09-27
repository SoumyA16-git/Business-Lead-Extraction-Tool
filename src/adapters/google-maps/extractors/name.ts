/**
 * Business Name Extractor with Layered Fallback Strategies
 * Defined in PRD Section 25.3
 */

export interface ExtractorResult<T> {
  value: T;
  strategyUsed: number;
}

export function isInvalidBusinessName(name: string | null | undefined): boolean {
  if (!name) return true;
  const n = name.trim().toLowerCase();
  return (
    n === "" ||
    n === "results" ||
    n === "search results" ||
    n.startsWith("results for") ||
    n === "google maps" ||
    n === "all filters" ||
    n === "overview" ||
    n === "reviews" ||
    n === "about" ||
    n === "photos"
  );
}

const NAME_STRATEGIES: Array<(doc: Document) => string | null> = [
  // Strategy 0: standard Google Maps detail panel heading classes
  (doc) => {
    const el = doc.querySelector('h1.DUwDvf, h1[class*="DUwDvf"], h1[class*="lfPIob"], div.DUwDvf, h2.DUwDvf');
    if (!el) return null;
    const firstSpan = el.querySelector("span");
    const cleanFirstSpan = firstSpan?.textContent?.trim();
    if (cleanFirstSpan && !isInvalidBusinessName(cleanFirstSpan)) {
      return cleanFirstSpan;
    }
    const lines = el.textContent?.split("\n").map((l) => l.trim()).filter(Boolean) || [];
    const text = lines[0] || el.textContent?.trim();
    return !isInvalidBusinessName(text) ? text! : null;
  },
  // Strategy 1: fontHeadlineLarge heading if not 'Results'
  (doc) => {
    const el = doc.querySelector('h1[class*="fontHeadlineLarge"], div[class*="fontHeadlineLarge"]');
    if (!el) return null;
    const lines = el.textContent?.split("\n").map((l) => l.trim()).filter(Boolean) || [];
    const text = lines[0] || el.textContent?.trim();
    return !isInvalidBusinessName(text) ? text! : null;
  },
  // Strategy 2: any heading in the main/detail region that is a valid business name
  (doc) => {
    const headings = doc.querySelectorAll('div[role="main"] h1, div[role="region"] h1, div.TI60gf h1, h1');
    for (const h of Array.from(headings)) {
      const text = h.textContent?.trim();
      if (!isInvalidBusinessName(text)) {
        return text!;
      }
    }
    return null;
  },
  // Strategy 3: standard Google search title attribute
  (doc) => {
    const text = doc.querySelector('[data-attrid="title"]')?.textContent?.trim();
    return !isInvalidBusinessName(text) ? text! : null;
  },
  // Strategy 4: aria-label of detail container if not results
  (doc) => {
    const mainPanels = doc.querySelectorAll('div[role="main"][aria-label], div.TI60gf[aria-label]');
    for (const p of Array.from(mainPanels)) {
      const label = p.getAttribute("aria-label")?.trim();
      if (!isInvalidBusinessName(label)) {
        return label!;
      }
    }
    return null;
  },
  // Strategy 5: Parse business name from location.href if it is a place URL
  (_doc) => {
    try {
      if (typeof window !== "undefined" && window.location?.href) {
        const url = window.location.href;
        const placeMatch = url.match(/\/maps\/place\/([^/@?]+)/);
        if (placeMatch) {
          const rawName = decodeURIComponent(placeMatch[1].replace(/\+/g, " ")).trim();
          if (!isInvalidBusinessName(rawName)) {
            return rawName;
          }
        }
      }
    } catch {
      // ignore
    }
    return null;
  },
];

export function extractName(doc: Document): ExtractorResult<string | null> {
  for (let i = 0; i < NAME_STRATEGIES.length; i++) {
    const val = NAME_STRATEGIES[i](doc);
    if (val && !isInvalidBusinessName(val)) {
      return { value: val, strategyUsed: i };
    }
  }
  return { value: null, strategyUsed: -1 };
}
