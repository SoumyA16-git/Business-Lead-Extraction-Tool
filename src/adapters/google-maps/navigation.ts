/**
 * Google Maps DOM Navigation, Feed Scrolling, and Stability Detection
 * Defined in PRD Sections 8.2-8.5 and 25.2
 */

import { SearchContext } from "../../core/schema/session";
import { RawCard } from "../../core/schema/business-record";
import { extractPlaceIdentifier } from "./extractors/place-identifier";

/**
 * Checks if detail panel has rendered and stabilized
 */
export function detectCompletion(doc: Document): boolean {
  if (!doc) return false;

  const headingEl = doc.querySelector(
    'h1.DUwDvf, h1[class*="DUwDvf"], h1[class*="lfPIob"], h1[class*="fontHeadlineLarge"]'
  );
  const headingText = headingEl?.textContent?.trim() || "";
  const isInvalidHeading =
    !headingText ||
    headingText.toLowerCase() === "results" ||
    headingText.toLowerCase().startsWith("results for") ||
    headingText.toLowerCase() === "google maps" ||
    headingText.toLowerCase() === "search results" ||
    headingText.toLowerCase() === "all filters";

  if (headingEl && !isInvalidHeading) {
    return true;
  }

  // Detail panel action buttons (Website, Directions, Save) or info buttons (address, phone)
  const hasDetailAction = !!doc.querySelector(
    'button[data-item-id*="address"], button[data-item-id*="phone"], button[data-item-id*="authority"], a[data-item-id="authority"], button[aria-label*="Address:" i], button[aria-label*="Phone:" i]'
  );

  const mainPanel = doc.querySelector('div[role="main"], div.TI60gf, div.bJzME');
  const hasContent =
    !!mainPanel?.querySelector('button[data-item-id], button[aria-label], div[class*="fontBodyMedium"]');

  return hasDetailAction || (!!headingEl && hasContent);
}

/**
 * Checks if the page navigated away from the search results or detail panel
 */
export function detectUnexpectedNavigation(
  doc: Document,
  url: string,
  expected: SearchContext
): boolean {
  if (!url.includes("google.com/maps") && !url.includes("maps.google.com")) {
    return true;
  }

  // If search query is expected, verify page or URL still contains search terms
  if (expected.query) {
    const qLower = expected.query.toLowerCase();
    const queryInUrl =
      url.toLowerCase().includes(encodeURIComponent(expected.query).toLowerCase()) ||
      url.toLowerCase().includes(expected.query.replace(/\s+/g, "+").toLowerCase());

    const input = (doc.querySelector('input#searchboxinput') ||
      doc.querySelector('input[id*="searchbox" i]')) as HTMLInputElement | null;
    const queryInSearchBox = input?.value?.toLowerCase() || "";

    if (!queryInUrl && queryInSearchBox && !queryInSearchBox.includes(qLower)) {
      return true;
    }
  }

  return false;
}

/**
 * Dispatches a standard, realistic pointer and mouse click sequence
 */
function simulateRealisticClick(el: HTMLElement): void {
  const rect = el.getBoundingClientRect();
  const clientX =
    rect.left > 0 || rect.top > 0 ? Math.round(rect.left + Math.max(10, rect.width / 2)) : 250;
  const clientY =
    rect.left > 0 || rect.top > 0 ? Math.round(rect.top + Math.max(10, rect.height / 2)) : 250;

  const downInit: PointerEventInit = {
    bubbles: true,
    cancelable: true,
    composed: true,
    view: typeof window !== "undefined" ? window : undefined,
    button: 0,
    buttons: 1,
    clientX,
    clientY,
    screenX: clientX,
    screenY: clientY,
    pointerId: 1,
    pointerType: "mouse",
    isPrimary: true,
  };

  const upInit: PointerEventInit = {
    ...downInit,
    buttons: 0,
  };

  try {
    el.focus();
  } catch {
    // ignore
  }

  try {
    if (typeof PointerEvent !== "undefined") {
      el.dispatchEvent(new PointerEvent("pointerdown", downInit));
    }
    el.dispatchEvent(new MouseEvent("mousedown", downInit));
    if (typeof PointerEvent !== "undefined") {
      el.dispatchEvent(new PointerEvent("pointerup", upInit));
    }
    el.dispatchEvent(new MouseEvent("mouseup", upInit));
    el.dispatchEvent(new MouseEvent("click", upInit));
  } catch {
    // ignore
  }

  try {
    el.click();
  } catch {
    // ignore
  }
}

export function findScrollableFeedContainer(doc: Document): HTMLElement | null {
  const feed = doc.querySelector('div[role="feed"]') as HTMLElement | null;
  if (feed) {
    let el: HTMLElement | null = feed;
    while (el && el !== doc.body) {
      if (el.scrollHeight > el.clientHeight && el.clientHeight > 80) {
        return el;
      }
      el = el.parentElement;
    }
    return feed;
  }

  const candidates = doc.querySelectorAll<HTMLElement>(
    'div.m6QErb.DxyBCb, div.m6QErb[aria-label*="Results" i], div[aria-label*="Results for" i], div.TI60gf, div.m6QErb'
  );
  for (const c of Array.from(candidates)) {
    if (c.scrollHeight > c.clientHeight && c.clientHeight > 80) {
      return c;
    }
  }
  return null;
}

/**
 * Navigates into a business's detail panel by simulating a genuine click
 */
export async function openBusinessCard(card: RawCard): Promise<void> {
  const mainPanel = document.querySelector('div[role="main"], div.TI60gf');
  const currentHeading = mainPanel?.querySelector("h1")?.textContent?.trim() || "";
  const currentPlaceId = extractPlaceIdentifier(window.location?.href || "");
  const targetPlaceId = extractPlaceIdentifier(card.cardRef);

  // 1. Check if the business detail panel is ALREADY open and displaying this business
  if (
    (targetPlaceId && currentPlaceId && targetPlaceId === currentPlaceId) ||
    (currentHeading && card.name && currentHeading.toLowerCase() === card.name.toLowerCase())
  ) {
    return;
  }

  // 2. Try to locate the card in the current DOM first
  let cardElement = findCardInFeed(card, document);

  // 3. If not found, check if results feed is hidden and return to results
  if (!cardElement) {
    const feed = document.querySelector('div[role="feed"]');
    const isFeedVisible =
      feed && (feed as HTMLElement).offsetParent !== null && (feed as HTMLElement).clientHeight > 50;

    if (!isFeedVisible) {
      await returnToResults();
      await new Promise((resolve) => setTimeout(resolve, 300));
      cardElement = findCardInFeed(card, document);
    }
  }

  // 4. If not found in DOM yet (e.g. further down the search results), scroll feed to reveal it
  if (!cardElement) {
    for (let attempt = 0; attempt < 6; attempt++) {
      await scrollResultsFeed(document);
      await new Promise((resolve) => setTimeout(resolve, 200));
      cardElement = findCardInFeed(card, document);
      if (cardElement) break;
    }
  }

  if (cardElement) {
    const container = (cardElement.closest('div.Nv2PK, div[role="article"]') || cardElement) as HTMLElement;
    const titleEl = container.querySelector(
      'div[class*="fontHeadlineSmall"], div[class*="qBF1Pd"], div.NrDZNb, div.fontTitleMedium'
    ) as HTMLElement | null;
    const overlayLink = (cardElement.tagName.toLowerCase() === "a"
      ? cardElement
      : container.querySelector("a.hfpxzc, a[href*='/maps/place/'], a") || cardElement) as HTMLElement;

    try {
      (titleEl || overlayLink || container).scrollIntoView({ behavior: "instant" as ScrollBehavior, block: "center" });
    } catch {
      // fallback
    }
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Simulate genuine clicks on title, overlay link, and container
    if (titleEl) {
      simulateRealisticClick(titleEl);
    }
    if (overlayLink && overlayLink !== titleEl) {
      simulateRealisticClick(overlayLink);
    }
    if (container && container !== titleEl && container !== overlayLink) {
      simulateRealisticClick(container);
    }
    return;
  }

  console.debug(`[Navigation] Card element not in visible DOM for "${card.name}"`);
}

/**
 * Finds a card element strictly within the results feed using stable identifiers
 */
function findCardInFeed(card: RawCard, doc = document): Element | null {
  const feed =
    doc.querySelector('div[role="feed"]') ||
    doc.querySelector('div.m6QErb.DxyBCb') ||
    doc.querySelector('div.m6QErb[aria-label*="Results" i]') ||
    doc;

  const targetPlaceId = extractPlaceIdentifier(card.cardRef);
  const targetName = (card.name || "").toLowerCase().trim();
  const tNorm = targetName.replace(/[^a-z0-9]/gi, "");

  // 1. By unique place identifier against all anchors
  if (targetPlaceId) {
    const feedLinks = feed.querySelectorAll<HTMLAnchorElement>('a.hfpxzc, a[href*="/maps/place/"], a[href*="data="]');
    for (const l of Array.from(feedLinks)) {
      const rawHref = (l.getAttribute("href") || "") + " " + (l.href || "");
      if (rawHref.includes(targetPlaceId)) {
        return l;
      }
    }
  }

  // 2. Check all card containers (div.Nv2PK, div[role="article"])
  const cardContainers = feed.querySelectorAll<HTMLElement>('div.Nv2PK, div[role="article"]');
  for (const c of Array.from(cardContainers)) {
    const link = c.querySelector<HTMLAnchorElement>('a.hfpxzc, a[href*="/maps/place/"], a');
    const rawHref = (link?.getAttribute("href") || "") + " " + (link?.href || "");
    if (targetPlaceId && rawHref.includes(targetPlaceId)) {
      return link || c;
    }

    const titleEl = c.querySelector('div[class*="fontHeadlineSmall"], div[class*="qBF1Pd"], div.NrDZNb');
    const cText = (titleEl?.textContent || "").toLowerCase().trim();
    const cNorm = cText.replace(/[^a-z0-9]/gi, "");

    const label = (link?.getAttribute("aria-label") || "").toLowerCase().trim();
    const labelNorm = label.replace(/[^a-z0-9]/gi, "");

    if (tNorm && (cNorm === tNorm || labelNorm === tNorm || (tNorm.length >= 4 && (cNorm.includes(tNorm) || tNorm.includes(cNorm) || labelNorm.includes(tNorm) || tNorm.includes(labelNorm))))) {
      return link || c;
    }
  }

  // 3. Exact aria-label matching business name on links
  if (tNorm) {
    const feedLinks = feed.querySelectorAll<HTMLElement>('a.hfpxzc, a[aria-label]');
    for (const l of Array.from(feedLinks)) {
      const label = (l.getAttribute("aria-label") || "").toLowerCase().trim();
      const labelNorm = label.replace(/[^a-z0-9]/gi, "");
      if (labelNorm === tNorm || (tNorm.length >= 4 && (labelNorm.includes(tNorm) || tNorm.includes(labelNorm)))) {
        return l;
      }
    }
  }

  return null;
}

/**
 * Returns to results feed via the Google Maps back button
 */
export async function returnToResults(): Promise<void> {
  const backBtn =
    (document.querySelector('button[aria-label*="Back to results" i]') as HTMLElement) ||
    (document.querySelector('button[jsaction*="pane.back" i]') as HTMLElement) ||
    (document.querySelector('button[data-tooltip*="Back to results" i]') as HTMLElement) ||
    (document.querySelector('button[data-tooltip*="Back" i]') as HTMLElement) ||
    (document.querySelector('button[aria-label="Back" i]') as HTMLElement) ||
    (document.querySelector('button[aria-label="Close" i]') as HTMLElement) ||
    (document.querySelector('button[jsaction*="pane.close" i]') as HTMLElement) ||
    (document.querySelector('button.w9kYg') as HTMLElement);

  if (backBtn && !isUploadOrContributionButton(backBtn) && !backBtn.closest('#searchbox, form')) {
    backBtn.click();
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}

/**
 * Detects if Google Maps has rendered the end-of-list indicator
 */
export function detectEndOfFeed(doc: Document): boolean {
  const endIndicator = doc.querySelector(
    'div.HlvSq, span.HlvSq, p[class*="fontBodyMedium"][class*="HlvSq"], div[class*="fontBodyMedium"][class*="HlvSq"]'
  );
  if (endIndicator) {
    const text = endIndicator.textContent?.toLowerCase().trim() || "";
    if (
      text.includes("end of the list") ||
      text.includes("end of results") ||
      text.includes("no more results")
    ) {
      return true;
    }
  }

  const feed = doc.querySelector('div[role="feed"]');
  if (feed) {
    const feedText = feed.textContent || "";
    if (
      feedText.includes("You've reached the end of the list") ||
      feedText.includes("You have reached the end of the list")
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Scrolls the Google Maps results feed container to load more business cards
 */
export async function scrollResultsFeed(doc: Document): Promise<boolean> {
  let scrollContainer = findScrollableFeedContainer(doc);
  const feed = doc.querySelector('div[role="feed"]') as HTMLElement | null;
  const isFeedVisible = feed && feed.offsetParent !== null && feed.clientHeight > 50;

  // If feed is not visible because a business detail panel is open, return to results first
  if (!isFeedVisible) {
    await returnToResults();
    await new Promise((resolve) => setTimeout(resolve, 250));
    scrollContainer = findScrollableFeedContainer(doc);
  }

  if (!scrollContainer) {
    if (typeof window !== "undefined") {
      window.scrollBy({ top: 1200, behavior: "instant" as ScrollBehavior });
    }
    return false;
  }

  const prevHeight = scrollContainer.scrollHeight;
  const prevTop = scrollContainer.scrollTop;
  const prevCardCount = (scrollContainer.parentElement || doc).querySelectorAll('div.Nv2PK, div[role="article"], a.hfpxzc').length;

  // Scroll the last card in feed into view to trigger intersection observer
  const cards = (feed || scrollContainer).querySelectorAll('div.Nv2PK, div[role="article"], a.hfpxzc');
  if (cards.length > 0) {
    const lastCard = cards[cards.length - 1] as HTMLElement;
    try {
      lastCard.scrollIntoView({ behavior: "instant" as ScrollBehavior, block: "end" });
    } catch {
      // fallback
    }
  }

  // Scroll down to the bottom
  scrollContainer.scrollTop = scrollContainer.scrollHeight;
  if (feed && feed !== scrollContainer) {
    feed.scrollTop = feed.scrollHeight;
  }

  // Dispatch scroll and wheel events to trigger Google Maps batch loader
  try {
    const scrollEvt = new Event("scroll", { bubbles: true });
    scrollContainer.dispatchEvent(scrollEvt);
    if (feed && feed !== scrollContainer) feed.dispatchEvent(scrollEvt);

    if (typeof WheelEvent !== "undefined") {
      const wheelEvt = new WheelEvent("wheel", { bubbles: true, deltaY: 1200 });
      scrollContainer.dispatchEvent(wheelEvt);
      if (feed && feed !== scrollContainer) feed.dispatchEvent(wheelEvt);
    }
  } catch {
    // ignore
  }

  // Adaptive wait for Google Maps to append new cards (up to 1200ms)
  let changed = false;
  for (let i = 0; i < 8; i++) {
    await new Promise((resolve) => setTimeout(resolve, 150));
    const newHeight = scrollContainer.scrollHeight;
    const newTop = scrollContainer.scrollTop;
    const newCardCount = (scrollContainer.parentElement || doc).querySelectorAll('div.Nv2PK, div[role="article"], a.hfpxzc').length;

    if (newHeight > prevHeight || newTop > prevTop || newCardCount > prevCardCount) {
      changed = true;
      break;
    }
  }

  return changed;
}

/**
 * Helper to identify buttons or elements that trigger user contributions or file uploads
 * (e.g. "Add a photo", "Upload photo", "Write a review", file inputs).
 * Clicking these elements must NEVER happen during automated extraction.
 */
export function isUploadOrContributionButton(el: Element | null): boolean {
  if (!el) return false;

  // Check for presence of file input inside or attached
  if (
    el.querySelector('input[type="file"]') ||
    (el.tagName.toLowerCase() === "input" && (el as HTMLInputElement).type === "file")
  ) {
    return true;
  }

  const ariaLabel = (el.getAttribute("aria-label") || "").toLowerCase().trim();
  const textContent = (el.textContent || "").toLowerCase().trim();
  const dataTooltip = (el.getAttribute("data-tooltip") || "").toLowerCase().trim();
  const title = (el.getAttribute("title") || "").toLowerCase().trim();
  const jsaction = (el.getAttribute("jsaction") || "").toLowerCase().trim();

  const combined = `${ariaLabel} ${textContent} ${dataTooltip} ${title} ${jsaction}`;

  // Phrases that indicate contribution / upload / compose actions
  const blockedPhrases = [
    "add a photo",
    "add photo",
    "add photos",
    "upload a photo",
    "upload photo",
    "upload photos",
    "upload",
    "post photo",
    "write a review",
    "write review",
    "add a review",
    "add review",
    "rate and review",
    "edit your review",
    "delete review",
    "flag as inappropriate",
    "report review",
    "suggest an edit",
    "add missing place",
    "claim this business",
    "own this business",
    "manage this business",
  ];

  for (const phrase of blockedPhrases) {
    if (combined.includes(phrase)) {
      return true;
    }
  }

  return false;
}

/**
 * Switches between Overview, Photos, Reviews, or About tabs in the detail panel
 */
export async function switchToTab(
  doc: Document,
  tabName: "Overview" | "Photos" | "Reviews" | "About"
): Promise<boolean> {
  // 1. Primary: query legitimate tab elements in the tablist or header
  const tabCandidates = doc.querySelectorAll<HTMLElement>(
    'div[role="tablist"] button[role="tab"], div[role="tablist"] div[role="tab"], button[role="tab"], div.R65duf button, div.Gpq6kf button, button.hh2c'
  );

  const target = tabName.toLowerCase();
  for (const tab of Array.from(tabCandidates)) {
    if (tab.closest('div[role="feed"]') || isUploadOrContributionButton(tab)) continue;

    const label = (tab.getAttribute("aria-label") || tab.textContent || "").toLowerCase().trim();

    let matches = false;
    if (target === "photos") {
      matches =
        label === "photos" ||
        label === "photos & videos" ||
        label.startsWith("photos") ||
        label.includes("photos of") ||
        (tab.textContent?.trim().toLowerCase() === "photos");
    } else if (target === "reviews") {
      matches =
        label === "reviews" ||
        label.startsWith("reviews") ||
        label.includes("customer reviews") ||
        label.includes("reviews for") ||
        (tab.textContent?.trim().toLowerCase() === "reviews");
    } else if (target === "overview") {
      matches = label === "overview" || tab.textContent?.trim().toLowerCase() === "overview";
    } else if (target === "about") {
      matches = label === "about" || tab.textContent?.trim().toLowerCase() === "about";
    }

    if (matches) {
      // Check if already active
      const isSelected = tab.getAttribute("aria-selected") === "true";
      if (!isSelected) {
        try {
          tab.scrollIntoView?.({ behavior: "instant" as ScrollBehavior, block: "center" });
        } catch {
          // Ignore in headless / jsdom environments
        }
        tab.click();
      }

      if (target === "reviews") {
        // Fast conditional wait for review cards or review container to appear
        const startWait = Date.now();
        while (Date.now() - startWait < 1200) {
          if (doc.querySelector('div.jftiEf, div[data-review-id], div.m6QErb[aria-label*="Reviews" i]')) {
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 80));
        }
      } else {
        await new Promise((resolve) => setTimeout(resolve, 600));
      }
      return true;
    }
  }

  // Fallback for Photos tab: clicking the hero header image / cover photo opens gallery
  if (tabName === "Photos") {
    const heroBtn = doc.querySelector<HTMLElement>(
      'button[jsaction*="heroHeader"], div[class*="hero"] img, button[aria-label*="Photo of" i]'
    );
    if (heroBtn && !heroBtn.closest('div[role="feed"]') && !isUploadOrContributionButton(heroBtn)) {
      heroBtn.click();
      await new Promise((resolve) => setTimeout(resolve, 600));
      return true;
    }
  }

  // Fallback for Reviews tab: clicking the rating summary button or more reviews button
  if (tabName === "Reviews") {
    const revBtn = doc.querySelector<HTMLElement>(
      'button[jsaction*="moreReviews" i], button[jsaction*="pane.rating" i], div.F7nice button, div.jANrlb button, button[aria-label*="stars" i][aria-label*="reviews" i]'
    );
    if (revBtn && !revBtn.closest('div[role="feed"]') && !isUploadOrContributionButton(revBtn)) {
      revBtn.click();
      const startWait = Date.now();
      while (Date.now() - startWait < 1200) {
        if (doc.querySelector('div.jftiEf, div[data-review-id], div.m6QErb[aria-label*="Reviews" i]')) {
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 80));
      }
      return true;
    }
  }

  return false;
}


