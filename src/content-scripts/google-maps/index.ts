/**
 * Google Maps Content Script
 * Defined in PRD Section 24 and 25
 */

import { GoogleMapsAdapter } from "../../adapters/google-maps";
import { isInvalidBusinessName } from "../../adapters/google-maps/extractors/name";
import { extractPlaceIdentifier } from "../../adapters/google-maps/extractors/place-identifier";
import { extractRatingAndReviews } from "../../adapters/google-maps/extractors/rating";
import { RawCard } from "../../core/schema/business-record";
import { WorkerToContent } from "../../shared/messages";

const adapter = new GoogleMapsAdapter();
let lastSearchQuery: string | null = null;
let lastDiscoveredCount = 0;

function sendToWorker(message: unknown): void {
  try {
    chrome.runtime.sendMessage(message).catch(() => {
      // Service worker may have restarted — ignore silently
    });
  } catch {
    // Extension context may be invalidated during unload
  }
}

/**
 * Returns true when the current URL is a business detail page, not a search results page.
 * On a business page, we should NOT send SEARCH_PAGE_DETECTED.
 */
function isBusinessDetailPage(url: string): boolean {
  // Business pages: /maps/place/... or contain a CID/place-id coordinate segment
  if (url.includes("/maps/place/")) return true;
  // URLs like https://www.google.com/maps/@lat,lng,zoom with no /search/ path
  if (url.includes("/maps/search/")) return false;
  // If URL has a place data segment like !1s0x... it's a business page
  if (/!1s0x[0-9a-f]+/i.test(url)) return true;
  return false;
}

/**
 * Checks active page state and scans for search results
 */
function scanPage(force = false): void {
  const url = window.location.href;
  if (!adapter.detectPlatform(document, url)) return;

  // Check verification
  if (adapter.detectVerification(document)) {
    sendToWorker({ type: "VERIFICATION_DETECTED" });
    return;
  }

  // When on a business detail page: only report the business target, never a search context.
  // This prevents SEARCH_PAGE_DETECTED from accidentally nuking an active extraction session.
  if (isBusinessDetailPage(url)) {
    const businessTarget = adapter.detectBusinessPage(document, url);
    if (businessTarget) {
      sendToWorker({
        type: "BUSINESS_PAGE_DETECTED",
        target: businessTarget,
        sourceUrl: url,
      });
    }
    return;
  }

  // Detect search page
  const searchContext = adapter.detectSearchPage(document, url);
  if (searchContext) {
    // Only send detected event if query changed or force
    if (force || searchContext.query !== lastSearchQuery) {
      lastSearchQuery = searchContext.query;
      sendToWorker({
        type: "SEARCH_PAGE_DETECTED",
        sourceUrl: url,
        searchContext,
      });
    }

    // Discover business cards
    const cards = adapter.discoverBusinesses(document);
    if (cards.length > 0 && (cards.length !== lastDiscoveredCount || force)) {
      lastDiscoveredCount = cards.length;
      sendToWorker({
        type: "BUSINESS_CARDS_DISCOVERED",
        cards,
      });
    }
  }

  // Detect single business page (PRD §7.2) for non-search pages
  const businessTarget = adapter.detectBusinessPage(document, url);
  if (businessTarget) {
    sendToWorker({
      type: "BUSINESS_PAGE_DETECTED",
      target: businessTarget,
      sourceUrl: url,
    });
  }
}

/**
 * Waits for the business detail panel to open and stabilize
 */
async function waitForStability(
  prevHeading?: string,
  targetName?: string,
  targetPlaceId?: string | null,
  maxWaitMs = 3500,
  pollIntervalMs = 50
): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    if (adapter.detectVerification(document)) {
      return false;
    }

    const currentHeading =
      document.querySelector('h1.DUwDvf, h1[class*="DUwDvf"], h1[class*="lfPIob"], h1[class*="fontHeadlineLarge"], div.DUwDvf')?.textContent?.trim() || "";

    const currentUrl = window.location?.href || "";
    const currentPlaceId = extractPlaceIdentifier(currentUrl);

    // 1. Target place ID in browser URL
    const isTargetPlaceInUrl = !!(targetPlaceId && currentPlaceId && targetPlaceId === currentPlaceId);

    // 2. Current heading matches target name
    let isTargetHeading = false;
    if (targetName && currentHeading) {
      const tNorm = targetName.toLowerCase().replace(/[^a-z0-9]/g, "");
      const cNorm = currentHeading.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (cNorm.includes(tNorm) || tNorm.includes(cNorm)) {
        isTargetHeading = true;
      } else {
        const tWords = targetName.toLowerCase().split(/[^a-z0-9]+/i).filter((w) => w.length >= 3);
        const cWords = currentHeading.toLowerCase().split(/[^a-z0-9]+/i).filter((w) => w.length >= 3);
        const overlap = tWords.filter((w) => cWords.includes(w));
        if (overlap.length >= 2 || (tWords.length === 1 && overlap.length === 1)) {
          isTargetHeading = true;
        }
      }
    }

    // 3. Heading has visibly transitioned away from previous business
    const isDifferentHeading = !!(
      prevHeading &&
      currentHeading &&
      currentHeading.toLowerCase() !== prevHeading.toLowerCase()
    );

    // 4. Initial business open (when no previous heading existed)
    const isInitialRender = !prevHeading && !!currentHeading;

    const hasValidHeading = !!currentHeading && !isInvalidBusinessName(currentHeading);
    const isHeadingReady = isTargetHeading || (hasValidHeading && (isDifferentHeading || isInitialRender));

    if ((isTargetPlaceInUrl || isHeadingReady) && (adapter.detectCompletion(document) || hasValidHeading)) {
      await new Promise((resolve) => setTimeout(resolve, 60));
      return true;
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
  return false;
}

const CONTENT_HANDLED_MESSAGES = new Set([
  "PING",
  "TRIGGER_PAGE_SCAN",
  "OPEN_BUSINESS",
  "SCROLL_RESULTS_FEED",
  "NAVIGATE_BACK_TO_RESULTS",
  "CHECK_PAGE_STATE",
  "SWITCH_TAB",
  "TRIGGER_MEDIA_DISCOVERY",
  "TRIGGER_MEDIA_SCROLL",
  "TRIGGER_REVIEWS_DISCOVERY",
  "TRIGGER_REVIEWS_SCROLL",
]);

// Handle messages from the service worker
chrome.runtime.onMessage.addListener((message: WorkerToContent, _sender, sendResponse) => {
  if (!message || !message.type || !CONTENT_HANDLED_MESSAGES.has(message.type)) {
    return false; // Do not return true for unhandled or UI broadcast messages
  }

  (async () => {
    try {
      switch (message.type) {
        case "PING": {
          sendResponse({ pong: true });
          break;
        }

        case "TRIGGER_PAGE_SCAN": {
          lastSearchQuery = null;
          lastDiscoveredCount = 0;
          scanPage(true);
          sendResponse({ success: true, lastSearchQuery, count: lastDiscoveredCount });
          break;
        }

        case "OPEN_BUSINESS": {
          if (adapter.detectVerification(document)) {
            sendResponse({ error: "verification_required" });
            return;
          }

          const targetPlaceId = extractPlaceIdentifier(message.cardRef);

          const dummyCard: RawCard = {
            cardRef: message.cardRef,
            name: message.name || "",
            cardFingerprint: "",
            discoveryIndex: message.discoveryIndex,
          };

          const prevHeading =
            document.querySelector('h1.DUwDvf, h1[class*="DUwDvf"], h1[class*="lfPIob"], h1[class*="fontHeadlineLarge"], div.DUwDvf')?.textContent?.trim() || "";

          let navigationFailed = false;
          try {
            await adapter.openBusiness(dummyCard);
          } catch (navErr) {
            console.debug("[Content] openBusiness navigation caught:", navErr);
            navigationFailed = true;
          }

          const isStable = !navigationFailed ? await waitForStability(prevHeading, dummyCard.name, targetPlaceId, 2500, 50) : false;

          const currentHeading =
            document.querySelector('h1.DUwDvf, h1[class*="DUwDvf"], h1[class*="lfPIob"], h1[class*="fontHeadlineLarge"], div.DUwDvf')?.textContent?.trim() || "";
          const currentPlaceId = extractPlaceIdentifier(window.location?.href || "");

          const isTargetName = dummyCard.name && currentHeading && (
            currentHeading.toLowerCase().includes(dummyCard.name.toLowerCase()) ||
            dummyCard.name.toLowerCase().includes(currentHeading.toLowerCase())
          );
          const isTargetPlace = !!(targetPlaceId && currentPlaceId && targetPlaceId === currentPlaceId);

          // Only considered stuck if it remained on a DIFFERENT business than the target
          const isStuckOnDifferent =
            prevHeading &&
            currentHeading &&
            prevHeading.toLowerCase() === currentHeading.toLowerCase() &&
            !isTargetName &&
            !isTargetPlace;

          if (adapter.detectVerification(document)) {
            sendResponse({ error: "verification_required" });
            return;
          }

          const detailOpened =
            !isStuckOnDifferent &&
            !navigationFailed &&
            (isStable || adapter.detectCompletion(document) || isTargetName || isTargetPlace);

          if (!detailOpened) {
            // Hybrid Smart Extraction: If detail panel delayed or failed to render,
            // recover immediately via high-fidelity feed card extraction!
            const feedRaw = adapter.extractBusinessFromFeed(document, dummyCard);
            if (feedRaw && feedRaw.name && !isInvalidBusinessName(feedRaw.name)) {
              console.log(`[Content] Detail panel did not settle for "${dummyCard.name}"; using feed card extraction.`);
              sendResponse({ status: "success", raw: feedRaw, isFeedFallback: true });
              return;
            }
            sendResponse({ error: "target_detail_not_ready" });
            return;
          }

          try {
            const raw = await adapter.extractBusiness(document, message.cardRef);
            if (!raw || !raw.name) {
              const feedRaw = adapter.extractBusinessFromFeed(document, dummyCard);
              if (feedRaw && feedRaw.name && !isInvalidBusinessName(feedRaw.name)) {
                sendResponse({ status: "success", raw: feedRaw, isFeedFallback: true });
                return;
              }
              sendResponse({ error: "empty_detail_extraction" });
              return;
            }
            sendResponse({ status: "success", raw });
          } catch (extractErr) {
            const feedRaw = adapter.extractBusinessFromFeed(document, dummyCard);
            if (feedRaw && feedRaw.name && !isInvalidBusinessName(feedRaw.name)) {
              console.log(`[Content] Detail extraction error for "${dummyCard.name}"; recovered via feed card:`, extractErr);
              sendResponse({ status: "success", raw: feedRaw, isFeedFallback: true });
              return;
            }
            sendResponse({
              error: extractErr instanceof Error ? extractErr.message : "extraction_failed",
            });
          }
          break;
        }

        case "SCROLL_RESULTS_FEED": {
          await adapter.discoverMore(document);
          const cards = adapter.discoverBusinesses(document);
          sendResponse({ cards });
          break;
        }

        case "NAVIGATE_BACK_TO_RESULTS": {
          await adapter.returnToResults();
          sendResponse({ success: true });
          break;
        }

        case "CHECK_PAGE_STATE": {
          const isVerif = adapter.detectVerification(document);
          sendResponse({ isVerification: isVerif });
          break;
        }

        case "SWITCH_TAB": {
          const success = await adapter.switchToBusinessTab(document, message.tab);
          sendResponse({ success });
          break;
        }

        case "TRIGGER_MEDIA_DISCOVERY": {
          const items = await adapter.discoverMedia(document, message.context);
          sendToWorker({
            type: "MEDIA_ITEMS_DISCOVERED",
            jobId: message.jobId,
            items,
          });
          sendResponse({
            ok: true,
            status: items.length > 0 ? "success" : "empty",
            discoveredCount: items.length,
            count: items.length,
            success: true,
            items,
          });
          break;
        }

        case "TRIGGER_MEDIA_SCROLL": {
          const scrolled = await adapter.discoverMoreMedia(document);
          sendResponse({
            ok: true,
            scrolled,
            changed: scrolled,
          });
          break;
        }

        case "TRIGGER_REVIEWS_DISCOVERY": {
          const reviews = await adapter.discoverReviews(document);
          const ratingInfo = extractRatingAndReviews(document);
          sendToWorker({
            type: "REVIEWS_DISCOVERED",
            jobId: message.jobId,
            reviews,
            reportedCount: ratingInfo.reviewCount,
          });
          sendResponse({
            ok: true,
            status: reviews.length > 0 ? "success" : "empty",
            discoveredCount: reviews.length,
            count: reviews.length,
            success: true,
            reviews,
          });
          break;
        }

        case "TRIGGER_REVIEWS_SCROLL": {
          const scrolled = await adapter.discoverMoreReviews(document);
          sendResponse({
            ok: true,
            scrolled,
            changed: scrolled,
          });
          break;
        }

        default: {
          sendResponse({ unhandled: true });
          break;
        }
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      sendResponse({ error: errMsg });
    }
  })();

  return true; // Keep sendResponse channel open for async
});

// Run initial scan
scanPage();

// URL change tracker for SPA navigations
let currentWatchedUrl = window.location.href;
function checkWatchedUrl(): void {
  const newUrl = window.location.href;
  if (newUrl !== currentWatchedUrl) {
    currentWatchedUrl = newUrl;
    // When transitioning back from a business page to search results,
    // always force a scan so the session picks up any new cards.
    // When navigating INTO a business page, isBusinessDetailPage guard
    // in scanPage() will prevent a false SEARCH_PAGE_DETECTED.
    scanPage(true);
  }
}
setInterval(checkWatchedUrl, 800);

// Observe DOM mutations to discover new cards or URL changes.
// Debounce increased to 2500ms — Google Maps triggers hundreds of DOM mutations
// per second during panel transitions; firing scanPage() too frequently causes
// the service worker to create spurious sessions mid-extraction.
let scanDebounceTimer: number | null = null;
const observer = new MutationObserver(() => {
  checkWatchedUrl();
  if (scanDebounceTimer) clearTimeout(scanDebounceTimer);
  scanDebounceTimer = window.setTimeout(() => {
    // Only run passive scan on non-business pages to avoid session noise
    if (!isBusinessDetailPage(window.location.href)) {
      scanPage();
    }
  }, 150);
});

observer.observe(document.body, { childList: true, subtree: true });

// Listen for history pushState / popstate events
window.addEventListener("popstate", () => {
  checkWatchedUrl();
  scanPage(true);
});
