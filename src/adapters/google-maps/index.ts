/**
 * Google Maps Platform Adapter
 * Implements PlatformAdapter interface defined in PRD Section 25
 */

import {
  BusinessIdentifier,
  DetectedBusinessTarget,
  PlatformAdapter,
} from "../../core/adapters/platform-adapter";
import { classifyWebsite } from "../../core/classification/website-classifier";
import { computeRecordFingerprints } from "../../core/dedup/identifier-chain";
import { computeMissingFields } from "../../core/missing-data/compute-missing";
import { normalizePhone } from "../../core/normalization/phone-normalizer";
import {
  BusinessRecord,
  RawBusinessData,
  RawCard,
} from "../../core/schema/business-record";
import { MediaSourceContext, RawMediaItem } from "../../core/schema/media-record";
import { RawReviewItem } from "../../core/schema/review-record";
import { SearchContext } from "../../core/schema/session";
import { extractAddress } from "./extractors/address";
import { extractAttributes } from "./extractors/attributes";
import { extractCategories } from "./extractors/categories";
import { extractOpeningHours } from "./extractors/hours";
import { extractMediaItems, scrollMediaGallery } from "./extractors/media";
import { extractName, isInvalidBusinessName } from "./extractors/name";
import { extractPhone } from "./extractors/phone";
import {
  extractCoordinates,
  extractPlaceIdentifier,
  extractPlusCode,
} from "./extractors/place-identifier";
import { extractRatingAndReviews } from "./extractors/rating";
import { extractReviews, scrollReviewsFeed, clickMoreReviewsButton } from "./extractors/reviews";
import {
  cleanAndValidateWebsite,
  extractDiscoveredSocialUrls,
  extractWebsiteUrl,
} from "./extractors/website";
import {
  detectCompletion,
  detectEndOfFeed,
  detectUnexpectedNavigation,
  openBusinessCard,
  returnToResults,
  scrollResultsFeed,
  switchToTab,
} from "./navigation";
import { detectVerification } from "./verification";

export class GoogleMapsAdapter implements PlatformAdapter {
  readonly platformId = "google_maps";

  detectPlatform(_doc: Document, url: string): boolean {
    return url.includes("google.com/maps") || url.includes("maps.google.com");
  }

  detectSearchPage(doc: Document, url: string): SearchContext | null {
    if (!this.detectPlatform(doc, url)) return null;

    let query: string | null = null;

    // 1. Check URL path e.g. /maps/search/dentists/
    const searchMatch = url.match(/\/maps\/search\/([^/@?]+)/);
    if (searchMatch) {
      try {
        query = decodeURIComponent(searchMatch[1].replace(/\+/g, " "));
      } catch {
        query = searchMatch[1];
      }
    }

    // 2. Check embedded search query in URL data param (e.g. /maps/place/.../data=...!2m1!1sdental+clinic+bhubaneswar!...)
    if (!query) {
      const dataMatch = url.match(/!2m1!1s([^!]+)/);
      if (dataMatch) {
        try {
          query = decodeURIComponent(dataMatch[1].replace(/\+/g, " "));
        } catch {
          query = dataMatch[1];
        }
      }
    }

    // 3. Check input searchbox
    if (!query) {
      const input = (doc.querySelector('input#searchboxinput') ||
        doc.querySelector('input[name="q"]') ||
        doc.querySelector('input[id*="searchbox" i]')) as HTMLInputElement | null;
      if (input && input.value) {
        query = input.value.trim();
      }
    }

    // 4. Fallback: URL search param ?q=
    if (!query) {
      try {
        const u = new URL(url);
        query = u.searchParams.get("q") || null;
      } catch {
        // ignore
      }
    }

    // 5. Fallback: Feed header label (e.g. Results for ...)
    if (!query) {
      const feedHeader = doc.querySelector(
        'div[aria-label*="Results for" i], div[role="feed"][aria-label*="Results for" i]'
      );
      if (feedHeader) {
        const label = feedHeader.getAttribute("aria-label") || "";
        const m = label.match(/Results for\s+["']?([^"']+)["']?/i);
        if (m) query = m[1].trim();
      }
    }

    // 6. Fallback: If results feed is present on Google Maps
    if (!query) {
      const hasFeed = doc.querySelector('div[role="feed"], a.hfpxzc, a[href*="/maps/place/"]');
      if (hasFeed) {
        query = "Google Maps Search";
      }
    }

    if (query) {
      return { query, locationHint: null };
    }

    return null;
  }

  discoverBusinesses(doc: Document): RawCard[] {
    const feed =
      doc.querySelector('div[role="feed"]') ||
      doc.querySelector('div.m6QErb.DxyBCb') ||
      doc.querySelector('div.m6QErb[aria-label*="Results" i]') ||
      doc;

    // Target unique card containers first
    let candidateNodes = Array.from(
      feed.querySelectorAll<HTMLElement>('div.Nv2PK, div[role="article"]')
    );

    if (candidateNodes.length === 0) {
      candidateNodes = Array.from(
        feed.querySelectorAll<HTMLElement>('a.hfpxzc, a[href*="/maps/place/"]')
      );
    }

    const cards: RawCard[] = [];
    const seenFingerprints = new Set<string>();

    let index = 0;
    for (const node of candidateNodes) {
      let name = "";
      let href = "";

      const link =
        node.tagName.toLowerCase() === "a"
          ? (node as HTMLAnchorElement)
          : node.querySelector<HTMLAnchorElement>('a.hfpxzc, a[href*="/maps/place/"], a[aria-label]');

      href = link?.getAttribute("href") || link?.href || "";

      const titleEl =
        node.querySelector('div[class*="fontHeadlineSmall"]') ||
        node.querySelector('div[class*="qBF1Pd"]') ||
        node.querySelector('div.NrDZNb') ||
        node.querySelector('div.fontTitleMedium');

      name =
        titleEl?.textContent?.trim() ||
        link?.getAttribute("aria-label")?.trim() ||
        "";

      if (isInvalidBusinessName(name)) {
        continue;
      }

      const placeId = extractPlaceIdentifier(href);
      const cardRef = href || (placeId ? placeId : `card-index-${index}`);

      const cardFingerprint = placeId
        ? `place:${placeId.toLowerCase()}`
        : `${name.toLowerCase().trim()}|${cardRef}`;

      if (seenFingerprints.has(cardFingerprint)) {
        continue;
      }
      seenFingerprints.add(cardFingerprint);

      const cardContainer =
        (node.tagName.toLowerCase() === "a" ? node.closest('div.Nv2PK, div[role="article"]') : node) || node;

      // Extract rating and reviews directly from feed card
      let cardRating: number | null = null;
      let cardReviews: number | null = null;
      let cardCategory: string | undefined = undefined;
      let cardAddress: string | undefined = undefined;

      const starEl = cardContainer.querySelector('[aria-label*="star" i]');
      if (starEl) {
        const label = starEl.getAttribute("aria-label") || "";
        const m = label.match(/(\d+\.?\d*)\s*stars?/i);
        if (m) {
          const r = parseFloat(m[1]);
          if (!isNaN(r) && r > 0 && r <= 5) cardRating = r;
        }
        const revM = label.match(/(\d[\d,]*)\s*reviews?/i);
        if (revM) {
          const rc = parseInt(revM[1].replace(/,/g, ""), 10);
          if (!isNaN(rc)) cardReviews = rc;
        }
      }

      if (cardRating === null) {
        const numSpan = cardContainer.querySelector('span[class*="MW4etd"]');
        if (numSpan) {
          const p = parseFloat(numSpan.textContent?.trim() || "");
          if (!isNaN(p) && p > 0 && p <= 5) cardRating = p;
        }
      }

      if (cardReviews === null) {
        const parenSpan = cardContainer.querySelector('span[class*="UY7F9"]');
        if (parenSpan) {
          const rc = parseInt(parenSpan.textContent?.replace(/[^\d]/g, "") || "", 10);
          if (!isNaN(rc)) cardReviews = rc;
        }
      }

      // Extract phone, category, and address snippet from feed card lines
      let cardPhone: string | undefined = undefined;
      const phonePattern = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3,5}\)?[-.\s]?\d{3,5}[-.\s]?\d{3,5}/;
      const lineSpans = cardContainer.querySelectorAll('div.W4Efsd span');
      for (const s of Array.from(lineSpans)) {
        const t = s.textContent?.trim() || "";
        if (!t || t === "·" || t.includes("★") || /^\d+(\.\d+)?$/.test(t)) continue;
        if (!cardPhone) {
          const m = t.match(phonePattern);
          if (m && m[0].replace(/\D/g, "").length >= 8) {
            cardPhone = m[0].trim();
          }
        }
        if (!cardCategory && /clinic|dentist|hospital|doctor|care|store|shop|hotel|restaurant|service|agency/i.test(t)) {
          cardCategory = t;
        } else if (!cardAddress && t.length > 5 && (/\d+|road|rd|street|st|lane|nagar|market|chowk|post|dist|marg/i.test(t) || t.includes(","))) {
          cardAddress = t;
        }
      }

      // Extract website from feed card if website button is present
      let cardWebsite: string | undefined = undefined;
      const websiteBtn = cardContainer.querySelector<HTMLAnchorElement>(
        'a[data-value="Website"], a[aria-label*="Website" i], a[data-tooltip*="Website" i], a[href*="/url?q="], a[href*="google.com/url?q="]'
      );
      if (websiteBtn) {
        const rawHref = websiteBtn.getAttribute("href") || websiteBtn.href || "";
        const clean = cleanAndValidateWebsite(rawHref);
        if (clean) cardWebsite = clean;
      }

      cards.push({
        cardRef,
        name,
        category: cardCategory,
        address: cardAddress,
        phone: cardPhone,
        website: cardWebsite,
        rating: cardRating,
        reviewCount: cardReviews,
        cardFingerprint,
        discoveryIndex: index,
      });

      index++;
    }

    return cards;
  }

  async discoverMore(doc: Document): Promise<boolean> {
    return scrollResultsFeed(doc);
  }

  detectEndOfFeed(doc: Document): boolean {
    return detectEndOfFeed(doc);
  }

  async openBusiness(card: RawCard): Promise<void> {
    return openBusinessCard(card);
  }

  async extractBusiness(doc: Document, fallbackUrl?: string): Promise<RawBusinessData> {
    const nameRes = extractName(doc);
    if (!nameRes.value || isInvalidBusinessName(nameRes.value)) {
      throw new Error(`Invalid or missing business name extracted: "${nameRes.value || ""}"`);
    }

    const addressRes = extractAddress(doc);
    const phoneRes = extractPhone(doc);
    const websiteRes = extractWebsiteUrl(doc);
    const socialUrls = extractDiscoveredSocialUrls(doc);
    const ratingRes = extractRatingAndReviews(doc);
    const catRes = extractCategories(doc);
    const hours = extractOpeningHours(doc);
    const attrRes = extractAttributes(doc);

    const targetPlaceId = fallbackUrl ? extractPlaceIdentifier(fallbackUrl) : null;
    const docPlaceId = doc.location?.href ? extractPlaceIdentifier(doc.location.href) : null;

    let mapsUrl = doc.location?.href || "";
    const isSearchUrl =
      !mapsUrl ||
      mapsUrl.includes("/maps/search/") ||
      mapsUrl.includes("/search?") ||
      mapsUrl.endsWith("/maps") ||
      mapsUrl.endsWith("/maps/");

    // If browser URL still belongs to a different place than fallbackUrl (stale URL), use fallbackUrl!
    if (targetPlaceId && docPlaceId && targetPlaceId !== docPlaceId) {
      mapsUrl = fallbackUrl || mapsUrl;
    } else if (isSearchUrl && fallbackUrl) {
      mapsUrl = fallbackUrl;
    }

    const placeIdentifier =
      (targetPlaceId && docPlaceId && targetPlaceId === docPlaceId)
        ? docPlaceId
        : (targetPlaceId || extractPlaceIdentifier(mapsUrl) || docPlaceId);

    const docCoords = extractCoordinates(mapsUrl);
    const coords =
      docCoords.lat !== null
        ? docCoords
        : fallbackUrl
        ? extractCoordinates(fallbackUrl)
        : { lat: null, lng: null };

    const plusCode = extractPlusCode(doc);

    return {
      name: nameRes.value,
      primaryCategory: catRes.primaryCategory,
      secondaryCategories: catRes.secondaryCategories,
      rating: ratingRes.rating,
      reviewCount: ratingRes.reviewCount,
      priceLevel: ratingRes.priceLevel,
      address: addressRes.value,
      phone: phoneRes.value,
      websiteUrl: websiteRes.value,
      socialUrls,
      mapsUrl,
      placeIdentifier,
      plusCode,
      coordinates: coords,
      hours,
      businessStatus: attrRes.businessStatus,
      description: attrRes.description,
      serviceOptions: attrRes.serviceOptions,
      attributes: attrRes.attributes,
    };
  }

  extractBusinessFromFeed(doc: Document, card: RawCard): RawBusinessData {
    let container: Element | null = null;
    const targetPlaceId = extractPlaceIdentifier(card.cardRef);
    const targetName = (card.name || "").toLowerCase().trim();
    const tNorm = targetName.replace(/[^a-z0-9]/gi, "");

    // 1. Locate matching card container in feed DOM
    const cardContainers = doc.querySelectorAll<HTMLElement>('div.Nv2PK, div[role="article"]');
    for (const c of Array.from(cardContainers)) {
      const link = c.querySelector<HTMLAnchorElement>('a.hfpxzc, a[href*="/maps/place/"], a');
      const rawHref = (link?.getAttribute("href") || "") + " " + (link?.href || "");
      if (targetPlaceId && rawHref.includes(targetPlaceId)) {
        container = c;
        break;
      }
      const titleEl = c.querySelector('div[class*="fontHeadlineSmall"], div[class*="qBF1Pd"], div.NrDZNb');
      const cText = (titleEl?.textContent || "").toLowerCase().trim();
      const cNorm = cText.replace(/[^a-z0-9]/gi, "");
      if (tNorm && (cNorm === tNorm || (tNorm.length >= 4 && (cNorm.includes(tNorm) || tNorm.includes(cNorm))))) {
        container = c;
        break;
      }
    }

    let name = card.name;
    let rating: number | null = card.rating ?? null;
    let reviewCount: number | null = card.reviewCount ?? null;
    let phone: string | null = card.phone ?? null;
    let address: string | null = card.address ?? null;
    let category: string | null = card.category ?? null;
    let websiteUrl: string | null = card.website ?? null;

    if (container) {
      const titleEl = container.querySelector(
        'div[class*="fontHeadlineSmall"], div[class*="qBF1Pd"], div.NrDZNb, div.fontTitleMedium'
      );
      if (titleEl?.textContent?.trim()) {
        name = titleEl.textContent.trim();
      }

      const starEl = container.querySelector('[aria-label*="star" i]');
      if (starEl) {
        const starLabel = starEl.getAttribute("aria-label") || "";
        if (rating === null) {
          const m = starLabel.match(/(\d+\.?\d*)\s*stars?/i);
          if (m) {
            const r = parseFloat(m[1]);
            if (!isNaN(r) && r > 0 && r <= 5) rating = r;
          }
        }
        if (reviewCount === null) {
          const revM = starLabel.match(/(\d[\d,]*)\s*reviews?/i);
          if (revM) {
            const rc = parseInt(revM[1].replace(/,/g, ""), 10);
            if (!isNaN(rc)) reviewCount = rc;
          }
        }
      }

      if (reviewCount === null) {
        const parenSpan = container.querySelector('span[class*="UY7F9"]');
        if (parenSpan) {
          const rc = parseInt(parenSpan.textContent?.replace(/[^\d]/g, "") || "", 10);
          if (!isNaN(rc)) reviewCount = rc;
        }
      }

      if (!websiteUrl) {
        const webBtn = container.querySelector<HTMLAnchorElement>(
          'a[data-value="Website"], a[aria-label*="Website" i], a[data-tooltip*="Website" i], a[href*="/url?q="], a[href*="google.com/url?q="]'
        );
        if (webBtn) {
          const rawHref = webBtn.getAttribute("href") || webBtn.href || "";
          const clean = cleanAndValidateWebsite(rawHref);
          if (clean) websiteUrl = clean;
        }
      }

      const phonePattern = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3,5}\)?[-.\s]?\d{3,5}[-.\s]?\d{3,5}/;
      const lineSpans = container.querySelectorAll('div.W4Efsd span');
      for (const s of Array.from(lineSpans)) {
        const t = s.textContent?.trim() || "";
        if (!t || t === "·" || t.includes("★") || /^\d+(\.\d+)?$/.test(t)) continue;
        if (!phone) {
          const m = t.match(phonePattern);
          if (m && m[0].replace(/\D/g, "").length >= 8) {
            phone = m[0].trim();
          }
        }
        if (!category && /clinic|dentist|hospital|doctor|care|store|shop|hotel|restaurant|service|agency/i.test(t)) {
          category = t;
        } else if (!address && t.length > 5 && (/\d+|road|rd|street|st|lane|nagar|market|chowk|post|dist|marg/i.test(t) || t.includes(","))) {
          address = t;
        }
      }
    }

    const rawMapsUrl = card.cardRef || "";
    const placeIdentifier = extractPlaceIdentifier(rawMapsUrl);
    const coords = extractCoordinates(rawMapsUrl);

    return {
      name: name || "Local Business",
      primaryCategory: category || "Local Business",
      secondaryCategories: [],
      rating,
      reviewCount,
      priceLevel: null,
      address: address || null,
      phone: phone || null,
      websiteUrl: websiteUrl || null,
      socialUrls: [],
      mapsUrl: rawMapsUrl,
      placeIdentifier,
      plusCode: null,
      coordinates: coords,
      hours: null,
      businessStatus: "operational",
      description: null,
      serviceOptions: [],
      attributes: [],
    };
  }

  normalizeBusiness(raw: RawBusinessData): Partial<BusinessRecord> {
    const classification = classifyWebsite(raw.websiteUrl, raw.socialUrls);
    const phoneNorm = normalizePhone(raw.phone, { address: raw.address });

    const record: Partial<BusinessRecord> = {
      business_name: raw.name?.trim() || "",
      primary_category: raw.primaryCategory?.trim() || "Local Business",
      secondary_categories: raw.secondaryCategories || [],
      rating: raw.rating ?? null,
      review_count: raw.reviewCount ?? null,
      price_level: (raw.priceLevel as BusinessRecord["price_level"]) ?? null,
      address: raw.address?.trim() || "",
      phone: phoneNorm.phone_normalized || raw.phone?.trim() || "",
      phone_raw: phoneNorm.phone_raw,
      phone_normalized: phoneNorm.phone_normalized,
      phone_country: phoneNorm.phone_country,
      phone_country_calling_code: phoneNorm.phone_country_calling_code,
      phone_country_source: phoneNorm.phone_country_source,
      phone_status: phoneNorm.phone_status,
      whatsapp_link: phoneNorm.whatsapp_link,
      website: classification.website,
      website_status: classification.website_status,
      social_links: classification.social_links,
      maps_url: raw.mapsUrl || "",
      place_identifier: raw.placeIdentifier || null,
      plus_code: raw.plusCode || null,
      latitude: raw.coordinates?.lat ?? null,
      longitude: raw.coordinates?.lng ?? null,
      opening_hours: raw.hours || null,
      business_status: raw.businessStatus || "operational",
      description: raw.description || null,
      service_options: raw.serviceOptions || [],
      attributes: raw.attributes || [],
      source_platform: "google_maps",
      duplicate_of: null,
      error_fields: classification.error_fields || [],
    };

    const { missing_fields, error_fields } = computeMissingFields(
      record,
      raw.unconfirmedFields
    );
    record.missing_fields = missing_fields;
    record.error_fields = error_fields;

    // Determine extraction status
    if (error_fields.length > 0 && (!record.business_name || !record.address)) {
      record.extraction_status = "failed";
    } else if (error_fields.length > 0) {
      record.extraction_status = "partial";
    } else {
      record.extraction_status = "complete";
    }

    return record;
  }

  getBusinessIdentifier(record: Partial<BusinessRecord>): BusinessIdentifier {
    const fps = computeRecordFingerprints(record);
    if (fps.placeIdentifier) {
      return { primary: fps.placeIdentifier, type: "place_identifier" };
    }
    if (fps.normalizedWebsite) {
      return { primary: fps.normalizedWebsite, type: "website" };
    }
    if (fps.normalizedMapsUrl) {
      return { primary: fps.normalizedMapsUrl, type: "maps_url" };
    }
    if (fps.nameAddressKey) {
      return { primary: fps.nameAddressKey, type: "name_address" };
    }
    if (fps.namePhoneKey) {
      return { primary: fps.namePhoneKey, type: "name_phone" };
    }
    return {
      primary: record.business_name || "unknown",
      type: "name_address",
    };
  }

  detectCompletion(doc: Document): boolean {
    return detectCompletion(doc);
  }

  detectVerification(doc: Document): boolean {
    return detectVerification(doc);
  }

  async returnToResults(): Promise<void> {
    return returnToResults();
  }

  detectUnexpectedNavigation(doc: Document, url: string, expected: SearchContext): boolean {
    return detectUnexpectedNavigation(doc, url, expected);
  }

  /**
   * Detect if the current page is a single business page (PRD §7.2, §37)
   */
  detectBusinessPage(doc: Document, url: string): DetectedBusinessTarget | null {
    if (!this.detectPlatform(doc, url)) return null;

    // If on a pure search page with feed and no business detail panel, return null
    const hasFeed = doc.querySelector('div[role="feed"]');
    const hasDetailHeading = doc.querySelector('h1.DUwDvf, h1[class*="DUwDvf"], h1[class*="lfPIob"]');
    if (hasFeed && !hasDetailHeading && !url.includes("/maps/place/")) {
      return null;
    }

    const nameRes = extractName(doc);
    if (!nameRes.value) return null;

    const addressRes = extractAddress(doc);
    const addressPreview = addressRes.value;

    const isPlaceUrl = url.includes("/maps/place/");
    let canonicalUrl = url;

    if (!isPlaceUrl) {
      // Check for share link or canonical link or place identifier in DOM
      const shareBtn = doc.querySelector('button[data-item-id*="share" i], button[aria-label*="Share" i]');
      const shareUrl = shareBtn?.getAttribute("data-url") || shareBtn?.getAttribute("data-link");
      if (shareUrl && shareUrl.includes("/maps/place/")) {
        canonicalUrl = shareUrl;
      } else {
        const placeLink = doc.querySelector<HTMLAnchorElement>('a[href*="/maps/place/"]');
        if (placeLink?.href) {
          canonicalUrl = placeLink.href;
        }
      }
    }

    const confidence: "high" | "low" =
      nameRes.strategyUsed === 0 && canonicalUrl.includes("/maps/place/")
        ? "high"
        : "low";

    return {
      business_name: nameRes.value,
      address_preview: addressPreview,
      maps_url: canonicalUrl,
      confidence,
    };
  }

  /**
   * Discover rendered media items (PRD §8, §37)
   */
  async discoverMedia(
    doc: Document,
    context: MediaSourceContext = "business_gallery"
  ): Promise<RawMediaItem[]> {
    return extractMediaItems(doc, context);
  }

  /**
   * Trigger further media loading (e.g. scroll gallery)
   */
  async discoverMoreMedia(doc: Document): Promise<boolean> {
    return scrollMediaGallery(doc);
  }

  /**
   * Discover rendered reviews (PRD §13, §37)
   */
  async discoverReviews(doc: Document): Promise<RawReviewItem[]> {
    return extractReviews(doc);
  }

  /**
   * Trigger further reviews loading: clicks "More reviews" button first, then scrolls.
   */
  async discoverMoreReviews(doc: Document): Promise<boolean> {
    // Try clicking "More reviews" button first; if not present, fall through to scroll
    const clicked = await clickMoreReviewsButton(doc);
    if (clicked) return true;
    return scrollReviewsFeed(doc);
  }

  /**
   * Switch between Overview, Photos, Reviews, About tabs
   */
  async switchToBusinessTab(
    doc: Document,
    tab: "Overview" | "Photos" | "Reviews" | "About"
  ): Promise<boolean> {
    return switchToTab(doc, tab);
  }
}
